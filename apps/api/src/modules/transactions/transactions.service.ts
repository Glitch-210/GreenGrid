import { prisma } from "../../config/prisma";
import { Decimal } from "../../lib/decimal";
import { ApiError } from "../../lib/ApiError";
import { isTransientTransactionError } from "../../lib/prisma-errors";
import { audit } from "../../lib/audit";
import { assertCanReadAny } from "../../lib/authorize";
import { notifyEach } from "../../lib/notify";
import { nextTransactionId } from "../../lib/ids";
import { env } from "../../config/env";
import * as gridService from "../grid/grid.service";
import { assertTransition } from "./state-machine";
import { emitToUser } from "../../sockets/io";
import { SOCKET_EVENTS } from "../../sockets/events";
import type { CreateTransactionInput } from "@wattshare/shared";
import type { AuthUser } from "../../middleware/auth.middleware";

/**
 * The loser of a reservation race aborts with Postgres 40001. Prisma surfaces that as
 * P2034, or as P2010 when it comes back from one of the raw `SELECT … FOR UPDATE` locks.
 */
function isSerializationFailure(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  if (!e) return false;
  if (e.code === "P2034") return true;
  return e.code === "P2010" && /40001|could not serialize/i.test(e.message ?? "");
}

/**
 * IMPLEMENTATION_PLAN.md §5.6 — the atomic core. Row-locks listings/credits in a
 * consistent order (listingId ASC) inside a Serializable transaction so two concurrent
 * purchases of the same last credits can never both succeed (demo Case 6).
 */
export async function createTransaction(buyer: AuthUser, input: CreateTransactionInput, idempotencyKey: string) {
  const existing = await prisma.transaction.findUnique({ where: { idempotencyKey } });
  if (existing) return existing;

  const sortedAllocations = [...input.allocations].sort((a, b) => a.listingId.localeCompare(b.listingId));

  const reserve = () => prisma.$transaction(
    async (tx) => {
      const total = sortedAllocations.reduce((sum, a) => sum.plus(a.kwh), new Decimal(0));

      const firstListing = await tx.marketplaceListing.findUniqueOrThrow({ where: { id: sortedAllocations[0].listingId } });
      const gridCheck = await gridService.canTrade(firstListing.gridZoneId, total);
      if (!gridCheck.ok) {
        throw ApiError.conflict(gridCheck.reason!, "Trade exceeds available grid capacity", {
          maxAllowedKwh: gridCheck.maxAllowedKwh,
        });
      }

      let totalCost = new Decimal(0);
      let sellerId: string | null = null;
      const matchRows: { buyerId: string; sellerId: string; listingId: string; quantityKwh: Decimal; pricePerKwh: Decimal; gridZoneId: string; score: Decimal }[] = [];

      // Lock + read every listing/credit in this purchase in one batch each, instead of
      // 2 raw FOR UPDATE queries + 2 reads per allocation — with 20-40 allocations the
      // old per-listing round-trip loop was long enough for Neon's pooler to reclaim
      // the connection mid-transaction. Lock order (ascending id) is preserved exactly
      // as before: it's what keeps two concurrent multi-allocation purchases sharing
      // listings from deadlocking, so it must stay even though the query is now batched.
      const listingIds = Array.from(new Set(sortedAllocations.map((a) => a.listingId)));
      await tx.$queryRaw`SELECT id FROM "MarketplaceListing" WHERE id = ANY(${listingIds}::text[]) ORDER BY id ASC FOR UPDATE`;
      const listingRows = await tx.marketplaceListing.findMany({ where: { id: { in: listingIds } } });
      const listingsById = new Map(listingRows.map((l) => [l.id, l]));
      for (const id of listingIds) {
        if (!listingsById.has(id)) throw ApiError.notFound("Listing not found");
      }

      const creditIds = Array.from(new Set(listingRows.map((l) => l.creditId)));
      await tx.$queryRaw`SELECT id FROM "EnergyCredit" WHERE id = ANY(${creditIds}::text[]) ORDER BY id ASC FOR UPDATE`;
      const creditRows = await tx.energyCredit.findMany({ where: { id: { in: creditIds } } });
      const creditsById = new Map(creditRows.map((c) => [c.id, c]));
      for (const id of creditIds) {
        if (!creditsById.has(id)) throw ApiError.notFound("Credit not found");
      }

      // Validate + compute the new state entirely in memory against the locked rows
      // (no per-check DB round trip), tracking running balances so two allocations
      // that happen to reference the same listing/credit still see each other's effect.
      const listingState = new Map(listingRows.map((l) => [l.id, { remainingKwh: new Decimal(l.remainingKwh), status: l.status }]));
      const creditState = new Map(
        creditRows.map((c) => [c.id, { availableKwh: new Decimal(c.availableKwh), reservedKwh: new Decimal(c.reservedKwh), status: c.status }]),
      );

      for (const alloc of sortedAllocations) {
        const listing = listingsById.get(alloc.listingId)!;
        const credit = creditsById.get(listing.creditId)!;
        const lState = listingState.get(listing.id)!;
        const cState = creditState.get(credit.id)!;

        if (!["ACTIVE", "PARTIAL"].includes(lState.status)) {
          throw ApiError.conflict("INSUFFICIENT_CREDITS", "Listing no longer available");
        }
        // Buying your own listing is a round trip that moves no energy and costs the
        // seller the platform fee for the privilege. Checked per allocation, so it
        // also catches a basket that mixes someone else's listing with your own.
        if (listing.sellerId === buyer.id) {
          throw ApiError.badRequest("SELF_TRADE", "You cannot buy your own listing");
        }
        const kwh = new Decimal(alloc.kwh);
        if (kwh.gt(lState.remainingKwh) || kwh.gt(cState.availableKwh)) {
          throw ApiError.conflict("INSUFFICIENT_CREDITS", "Not enough energy credits remaining");
        }
        if (credit.expiresAt.getTime() <= Date.now()) {
          throw ApiError.conflict("CREDIT_EXPIRED", "Credit has expired");
        }

        cState.availableKwh = cState.availableKwh.minus(kwh);
        cState.reservedKwh = cState.reservedKwh.plus(kwh);
        cState.status = cState.availableKwh.eq(0) ? "RESERVED" : "LISTED";

        lState.remainingKwh = lState.remainingKwh.minus(kwh);
        lState.status = lState.remainingKwh.eq(0) ? "RESERVED" : "PARTIAL";

        totalCost = totalCost.plus(kwh.times(listing.pricePerKwh));
        sellerId = sortedAllocations.length === 1 ? listing.sellerId : null;
        matchRows.push({
          buyerId: buyer.id,
          sellerId: listing.sellerId,
          listingId: listing.id,
          quantityKwh: kwh,
          pricePerKwh: listing.pricePerKwh,
          gridZoneId: listing.gridZoneId,
          // the ranking score was already used in /matching/find; this row is the
          // record of what was actually reserved, so a neutral score is stored here.
          score: new Decimal(1),
        });
      }

      // Write final state once per touched listing/credit (not once per allocation).
      for (const [creditId, cState] of creditState) {
        await tx.energyCredit.update({
          where: { id: creditId },
          // Both as Decimal. `.toNumber()` here rounded a Decimal(18,4) balance
          // through float64 and broke the available+reserved+sold+retired invariant.
          data: { availableKwh: cState.availableKwh, reservedKwh: cState.reservedKwh, status: cState.status },
        });
      }
      for (const [listingId, lState] of listingState) {
        await tx.marketplaceListing.update({
          where: { id: listingId },
          data: { remainingKwh: lState.remainingKwh, status: lState.status },
        });
      }

      const avgPrice = totalCost.div(total);
      const fee = totalCost.times(env.platformFeeRate);
      const sellerPayout = totalCost.minus(fee);

      const created = await tx.transaction.create({
        data: {
          transactionId: nextTransactionId(),
          idempotencyKey,
          buyerId: buyer.id,
          sellerId,
          quantityKwh: total,
          pricePerKwh: avgPrice,
          totalAmount: totalCost,
          platformFee: fee,
          sellerPayout,
          status: "RESERVED",
          gridZoneId: firstListing.gridZoneId,
        },
      });

      await tx.energyMatch.createMany({
        data: matchRows.map((m) => ({ ...m, transactionId: created.id, status: "RESERVED" as const })),
      });

      await audit(tx, "TRADE_MATCHED", "Transaction", created.id, buyer.id, { total: total.toString() });
      return created;
    },
    // 12s was not enough headroom for the documented target shape (a purchase
    // spanning 20-40 listings): on slower storage the batch locks and per-credit
    // writes ran past it and all three retries exhausted into TRANSACTION_TIMEOUT,
    // failing a purchase that was otherwise progressing fine. Holding locks a few
    // seconds longer is the lesser cost.
    { isolationLevel: "Serializable", timeout: 30_000 },
  );

  // §10 risk row: retry on a serialization failure (expected under contention — the
  // loser re-reads and either finds enough left or fails cleanly) and separately on a
  // transient transaction failure (P2028 — the pooler dropped/reassigned the connection
  // mid-transaction, or the interactive-transaction timeout fired; infra flakiness, not
  // a credits problem). The buyer never sees a raw Postgres error either way.
  const MAX_ATTEMPTS = 3;
  let txn: Awaited<ReturnType<typeof reserve>> | undefined;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      txn = await reserve();
      break;
    } catch (err) {
      const isLastAttempt = attempt === MAX_ATTEMPTS;
      if (isSerializationFailure(err)) {
        if (isLastAttempt) {
          // Lost the race repeatedly — under contention this only happens when other
          // buyers are taking the same credits, so report it as such rather than as a 500.
          throw ApiError.conflict("INSUFFICIENT_CREDITS", "Those credits were just taken by another buyer — please try again");
        }
        continue;
      }
      if (isTransientTransactionError(err)) {
        if (isLastAttempt) {
          throw ApiError.conflict("TRANSACTION_TIMEOUT", "Purchase timed out — please try again");
        }
        continue;
      }
      throw err;
    }
  }
  if (!txn) throw ApiError.conflict("TRANSACTION_TIMEOUT", "Purchase timed out — please try again");

  emitToUser(buyer.id, SOCKET_EVENTS.TRADE_MATCHED, { transactionId: txn.transactionId, status: txn.status });

  // The sellers are the other half of this trade and were previously told nothing.
  // Derived from the match rows because txn.sellerId is null on a multi-seller basket.
  const sellers = await prisma.energyMatch.findMany({
    where: { transactionId: txn.id },
    select: { sellerId: true, quantityKwh: true },
  });
  for (const sellerId of new Set(sellers.map((s) => s.sellerId))) {
    emitToUser(sellerId, SOCKET_EVENTS.TRADE_MATCHED, { transactionId: txn.transactionId, status: txn.status });
  }
  const soldBySeller = new Map<string, Decimal>();
  for (const s of sellers) {
    soldBySeller.set(s.sellerId, (soldBySeller.get(s.sellerId) ?? new Decimal(0)).plus(s.quantityKwh));
  }
  await notifyEach(
    [...soldBySeller.keys()],
    "TRADE_MATCHED",
    "Your credits are reserved",
    (id) => `A buyer reserved ${soldBySeller.get(id)!.toFixed(2)} EC from your listing. Awaiting payment.`,
    { transactionId: txn.transactionId },
  );

  scheduleReservationExpiry(txn.id);
  return txn;
}

function scheduleReservationExpiry(transactionId: string) {
  const timer = setTimeout(
    () => {
      releaseIfStillReserved(transactionId).catch(() => {});
    },
    env.reservationTtlMinutes * 60_000,
  );
  // Don't let a pending expiry hold the event loop open — the HTTP server keeps
  // the process alive in production, and tests can exit without waiting 5 minutes.
  timer.unref();
}

async function releaseIfStillReserved(transactionId: string) {
  const txn = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (txn && ["RESERVED", "PAYMENT_PENDING"].includes(txn.status)) {
    await releaseReservation(transactionId, "EXPIRED");
  }
}

/** Reverse the reserve math, restore listings, cancel matches. Called on failure/cancel/expiry. */
export async function releaseReservation(transactionId: string, toStatus: "CANCELLED" | "EXPIRED" = "CANCELLED") {
  return prisma.$transaction(async (tx) => {
    const txn = await tx.transaction.findUniqueOrThrow({ where: { id: transactionId }, include: { matches: true } });
    assertTransition(txn.status, toStatus);

    for (const match of txn.matches) {
      const listing = await tx.marketplaceListing.findUnique({ where: { id: match.listingId } });
      if (!listing) continue;
      const credit = await tx.energyCredit.findUnique({ where: { id: listing.creditId } });
      if (!credit) continue;

      await tx.energyCredit.update({
        where: { id: credit.id },
        data: { availableKwh: { increment: match.quantityKwh }, reservedKwh: { decrement: match.quantityKwh }, status: "AVAILABLE" },
      });

      // Recompute the listing's status from the restored quantity rather than
      // carrying the old one forward: a PARTIAL listing that is now whole again
      // stayed PARTIAL forever, mislabelling an untouched listing as part-sold.
      const restoredRemaining = new Decimal(listing.remainingKwh).plus(match.quantityKwh);
      await tx.marketplaceListing.update({
        where: { id: listing.id },
        data: {
          remainingKwh: restoredRemaining,
          status: restoredRemaining.gte(listing.quantityKwh) ? "ACTIVE" : "PARTIAL",
        },
      });
      await tx.energyMatch.update({ where: { id: match.id }, data: { status: "CANCELLED" } });
    }

    const updated = await tx.transaction.update({ where: { id: transactionId }, data: { status: toStatus } });
    await audit(tx, "RESERVATION_RELEASED", "Transaction", transactionId, null, { toStatus });
    return updated;
  });
}

export async function cancelTransaction(user: AuthUser, transactionId: string) {
  const txn = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!txn) throw ApiError.notFound("Transaction not found");
  if (txn.buyerId !== user.id) throw ApiError.forbidden("Not your transaction");
  if (!["RESERVED", "PAYMENT_PENDING"].includes(txn.status)) {
    throw ApiError.conflict("VALIDATION_ERROR", "Can only cancel before payment completes");
  }
  return releaseReservation(transactionId, "CANCELLED");
}

export async function getTransaction(user: AuthUser, id: string) {
  const txn = await prisma.transaction.findUnique({ where: { id }, include: { matches: true, payment: true, settlement: true } });
  if (!txn) throw ApiError.notFound("Transaction not found");
  // Buyer, any seller on the basket, or oversight. `txn.sellerId` alone is not
  // enough — it is null for multi-seller baskets, so check the matches too.
  assertCanReadAny(user, [txn.buyerId, txn.sellerId, ...txn.matches.map((m) => m.sellerId)], "Transaction");
  return txn;
}

export async function listTransactions(user: AuthUser) {
  if (user.role === "REGULATOR" || user.role === "ADMIN" || user.role === "UTILITY") {
    return prisma.transaction.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        buyer: { select: { name: true, displayAlias: true, email: true } },
        seller: { select: { name: true, displayAlias: true, email: true } },
        payment: true,
        settlement: true,
      },
    });
  }
  return prisma.transaction.findMany({
    where: {
      OR: [
        { buyerId: user.id },
        { sellerId: user.id },
        // sellerId is null on multi-seller baskets, so a seller's own sale would
        // otherwise be missing from their history entirely. The match rows carry
        // the real per-listing seller.
        { matches: { some: { sellerId: user.id } } },
      ],
    },
    orderBy: { createdAt: "desc" },
    include: {
      buyer: { select: { name: true, displayAlias: true, email: true } },
      seller: { select: { name: true, displayAlias: true, email: true } },
      payment: true,
      settlement: true,
    },
  });
}

