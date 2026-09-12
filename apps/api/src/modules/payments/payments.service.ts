import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { Decimal } from "../../lib/decimal";
import { ApiError } from "../../lib/ApiError";
import { audit } from "../../lib/audit";
import { assertTransition } from "../transactions/state-machine";
import { enqueueChainOp } from "../../adapters/chain/queue";
import { pseudoAddress, type CreditOrigin } from "../../adapters/chain/chain.service";
import { logger } from "../../lib/logger";
import { emitToUser } from "../../sockets/io";
import { notifyEach } from "../../lib/notify";
import { SOCKET_EVENTS } from "../../sockets/events";
import { isUniqueConstraintOn } from "../../lib/prisma-errors";
import type { CreatePaymentInput } from "@wattshare/shared";

function paymentReference() {
  return `PAY-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** §5.7 — mock payment gateway. Idempotent on the Idempotency-Key header. */
export async function createPayment(input: CreatePaymentInput, idempotencyKey: string) {
  const existingPayment = await prisma.payment.findFirst({ where: { transactionId: input.transactionId } });
  if (existingPayment) return existingPayment;

  const txn = await prisma.transaction.findUniqueOrThrow({ where: { id: input.transactionId }, include: { matches: true } });
  // A concurrent replay can land here after another in-flight call already moved
  // the transaction to PAYMENT_PENDING — that's the same request racing itself,
  // not an illegal transition, so leave the state machine alone and let the
  // Payment.transactionId unique constraint (below) settle who wins.
  if (txn.status !== "PAYMENT_PENDING") {
    assertTransition(txn.status, "PAYMENT_PENDING");
    await prisma.transaction.update({ where: { id: txn.id }, data: { status: "PAYMENT_PENDING" } });
  }

  await delay(1200);

  const failed = input.simulateFailure === true;
  let payment;
  try {
    payment = await prisma.payment.create({
      data: {
        transactionId: txn.id,
        amount: txn.totalAmount,
        paymentReference: `${paymentReference()}-${idempotencyKey.slice(0, 8)}`,
        status: failed ? "FAILED" : "SUCCESS",
      },
    });
  } catch (err) {
    // A concurrent replay can race past the findFirst guard above; the loser
    // hits Payment.transactionId's unique constraint instead of a clean 404/409.
    if (isUniqueConstraintOn(err, "transactionId")) {
      const raced = await prisma.payment.findUnique({ where: { transactionId: txn.id } });
      if (raced) return raced;
    }
    throw err;
  }

  if (failed) {
    await prisma.transaction.update({ where: { id: txn.id }, data: { status: "PAYMENT_FAILED" } });
    await releaseCredits(txn.id);
    emitToUser(txn.buyerId, SOCKET_EVENTS.PAYMENT_UPDATED, { transactionId: txn.transactionId, status: "FAILED" });
    return payment;
  }

  // The chain ops below must name the credits that actually changed hands. The
  // on-chain id is EnergyCredit.creditId — the one mintCredit was called with —
  // never the transaction id, which was never minted.
  const transferred: { creditId: string; qtyWh: string; origin: CreditOrigin }[] = [];

  await prisma.$transaction(async (tx) => {
    assertTransition("PAYMENT_PENDING", "PAID");
    await tx.transaction.update({ where: { id: txn.id }, data: { status: "PAID" } });

    for (const match of txn.matches) {
      const listing = await tx.marketplaceListing.findUnique({ where: { id: match.listingId } });
      if (!listing) continue;
      const credit = await tx.energyCredit.update({
        where: { id: listing.creditId },
        // Decimal, not float — this moves the seller's balance from reserved to sold.
        data: { reservedKwh: { decrement: match.quantityKwh }, soldKwh: { increment: match.quantityKwh } },
      });
      transferred.push({
        creditId: credit.creditId,
        qtyWh: toWattHours(match.quantityKwh),
        origin: { owner: pseudoAddress(credit.ownerId), qtyWh: toWattHours(credit.quantityKwh) },
      });
    }

    await tx.settlement.create({
      data: {
        transactionId: txn.id,
        consumerId: txn.buyerId,
        requestedKwh: txn.quantityKwh,
        status: "PENDING",
      },
    });

    await audit(tx, "PAYMENT_SUCCESS", "Transaction", txn.id, txn.buyerId, { amount: txn.totalAmount.toString() });
  });

  await transferOnChain(txn, transferred);

  emitToUser(txn.buyerId, SOCKET_EVENTS.PAYMENT_UPDATED, { transactionId: txn.transactionId, status: "PAID" });

  // This is the moment the seller's money is real — previously they were told nothing.
  const paidBySeller = new Map<string, Decimal>();
  for (const m of txn.matches) {
    paidBySeller.set(m.sellerId, (paidBySeller.get(m.sellerId) ?? new Decimal(0)).plus(new Decimal(m.quantityKwh).times(m.pricePerKwh)));
  }
  const feeMultiplier = new Decimal(1).minus(env.platformFeeRate);
  for (const sellerId of paidBySeller.keys()) {
    emitToUser(sellerId, SOCKET_EVENTS.PAYMENT_UPDATED, { transactionId: txn.transactionId, status: "PAID" });
  }
  await notifyEach(
    [...paidBySeller.keys()],
    "PAYMENT_RECEIVED",
    "You've been paid",
    (id) => `Payment received for your credits — ₹${paidBySeller.get(id)!.times(feeMultiplier).toFixed(2)} net of fees.`,
    { transactionId: txn.transactionId },
  );

  return payment;
}

function toWattHours(kwh: Decimal.Value): string {
  return new Decimal(kwh).times(1000).toFixed(0);
}

/**
 * A basket can span several sellers' credits, so payment fans out into one
 * transferCredit per credit. The lifecycle may only advance once — when the last
 * op lands — and any single failure is terminal for the transaction.
 */
async function transferOnChain(
  txn: { id: string; transactionId: string; buyerId: string },
  transferred: { creditId: string; qtyWh: string; origin: CreditOrigin }[],
) {
  const advance = async (txHash: string | null) => {
    await prisma.transaction.update({
      where: { id: txn.id },
      data: { status: "CREDIT_TRANSFERRED", ...(txHash ? { blockchainTxHash: txHash } : {}) },
    });
    await prisma.transaction.update({ where: { id: txn.id }, data: { status: "SETTLEMENT_PENDING" } });
    emitToUser(txn.buyerId, SOCKET_EVENTS.PAYMENT_UPDATED, {
      transactionId: txn.transactionId,
      status: "CREDIT_TRANSFERRED",
      blockchainTxHash: txHash,
    });
  };

  if (transferred.length === 0) {
    // No matched credits to move — nothing to anchor on-chain, but the lifecycle
    // must not strand at PAID.
    logger.warn("Payment settled with no matched credits to transfer", { transactionId: txn.transactionId });
    await advance(null);
    return;
  }

  const to = pseudoAddress(txn.buyerId);
  let remaining = transferred.length;
  let firstHash: string | null = null;
  let failed = false;

  for (const credit of transferred) {
    enqueueChainOp(
      { op: "transfer", creditId: credit.creditId, to, qtyWh: credit.qtyWh, origin: credit.origin },
      async (txHash) => {
        firstHash ??= txHash;
        remaining -= 1;
        if (remaining === 0 && !failed) await advance(firstHash);
      },
      async () => {
        if (failed) return;
        failed = true;
        await prisma.transaction.update({ where: { id: txn.id }, data: { status: "BLOCKCHAIN_FAILED" } });
      },
    );
  }
}

async function releaseCredits(transactionId: string) {
  const { releaseReservation } = await import("../transactions/transactions.service");
  await releaseReservation(transactionId, "CANCELLED").catch(() => {
    // best-effort — transaction may already be in a terminal state
  });
}

export async function getPayment(transactionId: string) {
  const payment = await prisma.payment.findUnique({ where: { transactionId } });
  if (!payment) throw ApiError.notFound("Payment not found");
  return payment;
}
