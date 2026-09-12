import { prisma } from "../../config/prisma";
import { Decimal } from "../../lib/decimal";
import { ApiError } from "../../lib/ApiError";
import { audit } from "../../lib/audit";
import { nextCreditId, nextTransactionId as _unused } from "../../lib/ids";
import { eligibleCreditKwh } from "../../lib/calculations";
import { env } from "../../config/env";
import { enqueueChainOp } from "../../adapters/chain/queue";
import { pseudoAddress } from "../../adapters/chain/chain.service";
import { emitToUser } from "../../sockets/io";
import { SOCKET_EVENTS } from "../../sockets/events";
import type { CreditStatus } from "@prisma/client";

void _unused;

/**
 * Mint an EnergyCredit batch from a VERIFIED, not-yet-issued MeterReading.
 * Enforces: reading must be VERIFIED, credits issued at most once per reading
 * (readingId is @unique), and gross surplus > 0 else no credit is minted.
 * IMPLEMENTATION_PLAN.md §5.1
 */
export async function mintFromReading(readingId: string) {
  const credit = await prisma.$transaction(async (tx) => {
    const reading = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "MeterReading" WHERE id = ${readingId} FOR UPDATE
    `;
    if (reading.length === 0) throw ApiError.notFound("Reading not found");

    const fullReading = await tx.meterReading.findUniqueOrThrow({
      where: { id: readingId },
      include: { meter: { include: { gridZone: true } } },
    });

    if (fullReading.status !== "VERIFIED") {
      throw ApiError.badRequest("READING_NOT_VERIFIED", "Reading has not been verified");
    }
    if (fullReading.creditIssued) {
      throw ApiError.conflict("CREDITS_ALREADY_ISSUED", "Credits already issued for this reading");
    }

    const zone = fullReading.meter.gridZone;
    const eligible = eligibleCreditKwh(fullReading.generationKwh, fullReading.consumptionKwh, zone.lossFactor);
    if (eligible.lte(0)) {
      await tx.meterReading.update({ where: { id: readingId }, data: { creditIssued: true } });
      return null;
    }

    const expiresAt = new Date(fullReading.timestamp.getTime() + env.creditValidityHours * 3_600_000);

    const created = await tx.energyCredit.create({
      data: {
        creditId: nextCreditId(zone.zoneCode, fullReading.timestamp),
        ownerId: fullReading.meter.userId,
        sourceMeterId: fullReading.meterId,
        readingId: fullReading.id,
        quantityKwh: eligible,
        availableKwh: eligible,
        status: "AVAILABLE",
        gridZoneId: zone.id,
        generatedAt: fullReading.timestamp,
        expiresAt,
      },
    });

    await tx.meterReading.update({ where: { id: readingId }, data: { creditIssued: true } });
    await audit(tx, "CREDIT_CREATED", "EnergyCredit", created.id, fullReading.meter.userId, {
      quantityKwh: eligible.toString(),
    });
    assertInvariant(created);
    return created;
  });

  if (!credit) return null;

  enqueueChainOp(
    { op: "mint", creditId: credit.creditId, qtyWh: toWattHours(credit.quantityKwh), owner: pseudoAddress(credit.ownerId) },
    async (txHash) => {
      await prisma.energyCredit.update({ where: { id: credit.id }, data: { blockchainTxHash: txHash, status: "MINTED" } });
      emitToUser(credit.ownerId, SOCKET_EVENTS.CREDIT_MINTED, { creditId: credit.creditId, blockchainTxHash: txHash });
    },
  );

  emitToUser(credit.ownerId, SOCKET_EVENTS.CREDIT_MINTED, { creditId: credit.creditId, quantityKwh: credit.quantityKwh.toString() });
  return credit;
}

function toWattHours(kwh: Decimal.Value): string {
  return new Decimal(kwh).times(1000).toFixed(0);
}

/** available + reserved + sold + retired == quantity, available/reserved >= 0. */
function assertInvariant(c: { quantityKwh: Decimal; availableKwh: Decimal; reservedKwh: Decimal; soldKwh: Decimal; retiredKwh: Decimal }) {
  const sum = new Decimal(c.availableKwh).plus(c.reservedKwh).plus(c.soldKwh).plus(c.retiredKwh);
  if (!sum.equals(c.quantityKwh)) {
    throw new Error(`Credit balance invariant violated: ${sum.toString()} != ${c.quantityKwh.toString()}`);
  }
  if (c.availableKwh.lt(0) || c.reservedKwh.lt(0)) {
    throw new Error("Credit balance went negative");
  }
}

export async function listCreditsForOwner(ownerId: string, status?: CreditStatus) {
  return prisma.energyCredit.findMany({
    where: { ownerId, ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
  });
}

export async function getCreditById(id: string) {
  const credit = await prisma.energyCredit.findUnique({ where: { id } });
  if (!credit) throw ApiError.notFound("Credit not found");
  return credit;
}
