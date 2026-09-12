import { prisma } from "../../config/prisma";
import { Decimal } from "../../lib/decimal";
import { ApiError } from "../../lib/ApiError";
import { audit } from "../../lib/audit";
import { nextTransactionId } from "../../lib/ids";
import { env } from "../../config/env";
import * as gridService from "../grid/grid.service";
import { assertTransition } from "./state-machine";
import { emitToUser } from "../../sockets/io";
import { SOCKET_EVENTS } from "../../sockets/events";
import type { CreateTransactionInput } from "@wattshare/shared";
import type { AuthUser } from "../../middleware/auth.middleware";

/**
 * IMPLEMENTATION_PLAN.md §5.6 — the atomic core. Row-locks listings/credits in a
 * consistent order (listingId ASC) inside a Serializable transaction so two concurrent
 * purchases of the same last credits can never both succeed (demo Case 6).
 */
export async function createTransaction(buyer: AuthUser, input: CreateTransactionInput, idempotencyKey: string) {
  const existing = await prisma.transaction.findUnique({ where: { idempotencyKey } });
  if (existing) return existing;

  const sortedAllocations = [...input.allocations].sort((a, b) => a.listingId.localeCompare(b.listingId));

  const txn = await prisma.$transaction(
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

      for (const alloc of sortedAllocations) {
        await tx.$queryRaw`SELECT id FROM "MarketplaceListing" WHERE id = ${alloc.listingId} FOR UPDATE`;
        const listing = await tx.marketplaceListing.findUniqueOrThrow({ where: { id: alloc.listingId } });
        await tx.$queryRaw`SELECT id FROM "EnergyCredit" WHERE id = ${listing.creditId} FOR UPDATE`;
        const credit = await tx.energyCredit.findUniqueOrThrow({ where: { id: listing.creditId } });

        if (!["ACTIVE", "PARTIAL"].includes(listing.status)) {
          throw ApiError.conflict("INSUFFICIENT_CREDITS", "Listing no longer available");
        }
        const kwh = new Decimal(alloc.kwh);
        if (kwh.gt(listing.remainingKwh) || kwh.gt(credit.availableKwh)) {
          throw ApiError.conflict("INSUFFICIENT_CREDITS", "Not enough energy credits remaining");
        }
        if (credit.expiresAt.getTime() <= Date.now()) {
          throw ApiError.conflict("CREDIT_EXPIRED", "Credit has expired");
        }

        const newAvailable = new Decimal(credit.availableKwh).minus(kwh);
        await tx.energyCredit.update({
          where: { id: credit.id },
          data: {
            availableKwh: newAvailable,
            reservedKwh: { increment: kwh.toNumber() },
            status: newAvailable.eq(0) ? "RESERVED" : "LISTED",
          },
        });

        const newRemaining = new Decimal(listing.remainingKwh).minus(kwh);
        await tx.marketplaceListing.update({
          where: { id: listing.id },
          data: { remainingKwh: newRemaining, status: newRemaining.eq(0) ? "RESERVED" : "PARTIAL" },
        });

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

      for (const m of matchRows) {
        await tx.energyMatch.create({
          data: { ...m, transactionId: created.id, status: "RESERVED" },
        });
      }

      await audit(tx, "TRADE_MATCHED", "Transaction", created.id, buyer.id, { total: total.toString() });
      return created;
    },
    { isolationLevel: "Serializable", timeout: 8000 },
  );

  emitToUser(buyer.id, SOCKET_EVENTS.TRADE_MATCHED, { transactionId: txn.transactionId, status: txn.status });
  scheduleReservationExpiry(txn.id);
  return txn;
}

function scheduleReservationExpiry(transactionId: string) {
  setTimeout(
    () => {
      releaseIfStillReserved(transactionId).catch(() => {});
    },
    env.reservationTtlMinutes * 60_000,
  );
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
        data: { availableKwh: { increment: match.quantityKwh.toNumber() }, reservedKwh: { decrement: match.quantityKwh.toNumber() }, status: "AVAILABLE" },
      });
      await tx.marketplaceListing.update({
        where: { id: listing.id },
        data: { remainingKwh: { increment: match.quantityKwh.toNumber() }, status: listing.status === "RESERVED" ? "ACTIVE" : "PARTIAL" },
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

export async function getTransaction(id: string) {
  const txn = await prisma.transaction.findUnique({ where: { id }, include: { matches: true, payment: true, settlement: true } });
  if (!txn) throw ApiError.notFound("Transaction not found");
  return txn;
}

export async function listTransactions(userId: string) {
  return prisma.transaction.findMany({ where: { OR: [{ buyerId: userId }, { sellerId: userId }] }, orderBy: { createdAt: "desc" } });
}
