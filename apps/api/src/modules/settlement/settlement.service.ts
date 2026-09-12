import { prisma } from "../../config/prisma";
import { Decimal } from "../../lib/decimal";
import { logger } from "../../lib/logger";
import { audit } from "../../lib/audit";
import { utilityAdapter } from "../../adapters/utility";
import { enqueueChainOp } from "../../adapters/chain/queue";
import { pseudoAddress } from "../../adapters/chain/chain.service";
import { emitToUser } from "../../sockets/io";
import { notifyEach } from "../../lib/notify";
import { SOCKET_EVENTS } from "../../sockets/events";

/**
 * §5.8 — poll job, every 10s. Submits PENDING settlements to the (mock) DISCOM,
 * then polls SUBMITTED ones for a result. Credits are only retired for the
 * settled portion, and only once the utility confirms — never on submit.
 */
export async function pollSettlements() {
  await submitPending();
  await pollSubmitted();
}

async function submitPending() {
  const pending = await prisma.settlement.findMany({ where: { status: "PENDING", discomReference: null }, include: { transaction: true } });

  for (const settlement of pending) {
    try {
      const ack = await utilityAdapter.submitSettlement({
        transactionId: settlement.transactionId,
        consumerId: settlement.consumerId,
        zoneId: settlement.transaction.gridZoneId,
        requestedKwh: settlement.requestedKwh.toFixed(4),
      });
      await prisma.settlement.update({
        where: { id: settlement.id },
        data: { discomReference: ack.reference, status: "SUBMITTED", attempts: { increment: 1 } },
      });
    } catch (err) {
      await prisma.settlement.update({ where: { id: settlement.id }, data: { attempts: { increment: 1 }, failureReason: String(err) } });
      logger.warn("Settlement submission failed, will retry", { settlementId: settlement.id, error: String(err) });
    }
  }
}

async function pollSubmitted() {
  const submitted = await prisma.settlement.findMany({
    where: { status: "SUBMITTED" },
    include: { transaction: { include: { matches: true } } },
  });

  for (const settlement of submitted) {
    if (!settlement.discomReference) continue;
    const result = await utilityAdapter.getSettlementStatus(settlement.discomReference);
    if (result.status === "PENDING") continue;

    const tariff = await utilityAdapter.getTariff(settlement.transaction.gridZoneId);
    const settledKwh = new Decimal(result.settledKwh ?? "0");
    const billAdjustment = settledKwh.times(tariff.ratePerKwh);

    const status =
      result.status === "SETTLED" ? "SETTLED" : result.status === "PARTIAL" ? "PARTIAL" : result.status === "FAILED" ? "FAILED" : "MISMATCH";

    await prisma.settlement.update({
      where: { id: settlement.id },
      data: { status, settledKwh, billAdjustment, settledAt: new Date() },
    });

    if (status !== "FAILED") {
      await retireSettledCredits(settlement.transaction.id, settlement.transaction.matches, settledKwh, settlement.requestedKwh);
      await prisma.transaction.update({
        where: { id: settlement.transaction.id },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
    }

    if (status === "MISMATCH") {
      await audit(prisma, "SETTLEMENT_MISMATCH", "Settlement", settlement.id, settlement.consumerId, {
        requested: settlement.requestedKwh.toString(),
        settled: settledKwh.toString(),
      });
    }

    const payload = {
      transactionId: settlement.transaction.transactionId,
      status,
      settledKwh: settledKwh.toFixed(4),
      billAdjustment: billAdjustment.toFixed(4),
    };
    emitToUser(settlement.consumerId, SOCKET_EVENTS.SETTLEMENT_UPDATED, payload);

    // Settlement retires the sellers' credits, so it closes out their side of the
    // trade too — they should see it land, not just the consumer.
    const sellerIds = [...new Set(settlement.transaction.matches.map((m) => m.sellerId))];
    for (const sellerId of sellerIds) {
      emitToUser(sellerId, SOCKET_EVENTS.SETTLEMENT_UPDATED, payload);
    }
    await notifyEach(
      sellerIds,
      "SETTLEMENT_COMPLETE",
      status === "SETTLED" ? "Trade settled with the DISCOM" : `Settlement ${status.toLowerCase()}`,
      () => `${settledKwh.toFixed(2)} EC settled against the grid for ${settlement.transaction.transactionId}.`,
      { transactionId: settlement.transaction.transactionId },
    );
  }
}

async function retireSettledCredits(
  transactionId: string,
  matches: { id: string; listingId: string; quantityKwh: Decimal }[],
  settledKwh: Decimal,
  requestedKwh: Decimal,
) {
  const fraction = requestedKwh.gt(0) ? settledKwh.div(requestedKwh) : new Decimal(0);

  for (const match of matches) {
    const listing = await prisma.marketplaceListing.findUnique({ where: { id: match.listingId } });
    if (!listing) continue;
    const retireQty = new Decimal(match.quantityKwh).times(fraction);
    if (retireQty.lte(0)) continue;

    const credit = await prisma.energyCredit.update({
      where: { id: listing.creditId },
      data: {
        // Decimal throughout: retireQty is a fraction of the match quantity, so this
        // is exactly where float rounding would leave a credit that never fully retires.
        soldKwh: { decrement: retireQty },
        retiredKwh: { increment: retireQty },
      },
    });

    if (new Decimal(credit.soldKwh).lte(0) && new Decimal(credit.availableKwh).lte(0) && new Decimal(credit.reservedKwh).lte(0)) {
      await prisma.energyCredit.update({ where: { id: credit.id }, data: { status: "RETIRED" } });
    }

    enqueueChainOp(
      {
        op: "retire",
        creditId: credit.creditId,
        qtyWh: retireQty.times(1000).toFixed(0),
        ref: transactionId,
        origin: { owner: pseudoAddress(credit.ownerId), qtyWh: new Decimal(credit.quantityKwh).times(1000).toFixed(0) },
      },
      async (txHash) => {
        await prisma.energyCredit.update({ where: { id: credit.id }, data: { blockchainTxHash: txHash } });
      },
    );
  }
}
