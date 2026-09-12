import { prisma } from "../../config/prisma";
import { Decimal } from "../../lib/decimal";
import { ApiError } from "../../lib/ApiError";
import { audit } from "../../lib/audit";
import { assertTransition } from "../transactions/state-machine";
import { enqueueChainOp } from "../../adapters/chain/queue";
import { pseudoAddress } from "../../adapters/chain/chain.service";
import { emitToUser } from "../../sockets/io";
import { SOCKET_EVENTS } from "../../sockets/events";
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
  assertTransition(txn.status, "PAYMENT_PENDING");
  await prisma.transaction.update({ where: { id: txn.id }, data: { status: "PAYMENT_PENDING" } });

  await delay(1200);

  const failed = input.simulateFailure === true;
  const payment = await prisma.payment.create({
    data: {
      transactionId: txn.id,
      amount: txn.totalAmount,
      paymentReference: `${paymentReference()}-${idempotencyKey.slice(0, 8)}`,
      status: failed ? "FAILED" : "SUCCESS",
    },
  });

  if (failed) {
    await prisma.transaction.update({ where: { id: txn.id }, data: { status: "PAYMENT_FAILED" } });
    await releaseCredits(txn.id);
    emitToUser(txn.buyerId, SOCKET_EVENTS.PAYMENT_UPDATED, { transactionId: txn.transactionId, status: "FAILED" });
    return payment;
  }

  await prisma.$transaction(async (tx) => {
    assertTransition("PAYMENT_PENDING", "PAID");
    await tx.transaction.update({ where: { id: txn.id }, data: { status: "PAID" } });

    for (const match of txn.matches) {
      const listing = await tx.marketplaceListing.findUnique({ where: { id: match.listingId } });
      if (!listing) continue;
      await tx.energyCredit.update({
        where: { id: listing.creditId },
        data: { reservedKwh: { decrement: match.quantityKwh.toNumber() }, soldKwh: { increment: match.quantityKwh.toNumber() } },
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

  enqueueChainOp(
    { op: "transfer", creditId: txn.transactionId, to: pseudoAddress(txn.buyerId), qtyWh: new Decimal(txn.quantityKwh).times(1000).toFixed(0) },
    async (txHash) => {
      await prisma.transaction.update({ where: { id: txn.id }, data: { blockchainTxHash: txHash, status: "CREDIT_TRANSFERRED" } });
      await prisma.transaction.update({ where: { id: txn.id }, data: { status: "SETTLEMENT_PENDING" } });
      emitToUser(txn.buyerId, SOCKET_EVENTS.PAYMENT_UPDATED, { transactionId: txn.transactionId, status: "CREDIT_TRANSFERRED", blockchainTxHash: txHash });
    },
    async () => {
      await prisma.transaction.update({ where: { id: txn.id }, data: { status: "BLOCKCHAIN_FAILED" } });
    },
  );

  emitToUser(txn.buyerId, SOCKET_EVENTS.PAYMENT_UPDATED, { transactionId: txn.transactionId, status: "PAID" });
  return payment;
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
