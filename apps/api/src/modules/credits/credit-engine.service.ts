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
import { assertOwns, assertCanRead } from "../../lib/authorize";
import type { AuthUser } from "../../middleware/auth.middleware";
import type { CreditStatus } from "@prisma/client";

void _unused;

/**
 * Mint an EnergyCredit batch from a VERIFIED, not-yet-issued MeterReading.
 * Enforces: reading must be VERIFIED, credits issued at most once per reading
 * (readingId is @unique), and gross surplus > 0 else no credit is minted.
 * IMPLEMENTATION_PLAN.md §5.1
 */
export async function mintFromReading(readingId: string, requestedBy?: AuthUser) {
  const credit = await prisma.$transaction(async (tx) => {
    const reading = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "MeterReading" WHERE id = ${readingId} FOR UPDATE
    `;
    if (reading.length === 0) throw ApiError.notFound("Reading not found");

    const fullReading = await tx.meterReading.findUniqueOrThrow({
      where: { id: readingId },
      include: { meter: { include: { gridZone: true } } },
    });

    // When a request drives this (POST /credits/generate) the caller must own the
    // meter. The scheduler/simulator passes no user and is trusted.
    if (requestedBy) assertOwns(requestedBy, fullReading.meter.userId, "Reading");

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
      // Record the anchor only. Status must NOT become "MINTED" here: being on
      // chain says nothing about sellability, and overwriting AVAILABLE hid every
      // freshly minted credit from the seller's Sell page.
      await prisma.energyCredit.update({ where: { id: credit.id }, data: { blockchainTxHash: txHash } });
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

/** Statuses in which a credit can never be sold, whatever its balance says. */
const UNSELLABLE_STATUSES: CreditStatus[] = ["FROZEN", "EXPIRED", "RETIRED", "SETTLED"];

export async function listCreditsForOwner(ownerId: string, status?: CreditStatus, sellable?: boolean) {
  const credits = await prisma.energyCredit.findMany({
    where: { ownerId, ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
  });
  if (!sellable) return credits;

  // A credit's availableKwh does NOT drop when it is listed (only a buyer's
  // reservation moves balance — §5.6), so "how much can I still list?" is
  // availableKwh minus what open listings already spoke for. Anything with a
  // positive remainder is sellable regardless of status.
  const listed = await prisma.marketplaceListing.groupBy({
    by: ["creditId"],
    where: { creditId: { in: credits.map((c) => c.id) }, status: { in: ["ACTIVE", "PARTIAL"] } },
    _sum: { remainingKwh: true },
  });
  const listedByCredit = new Map(listed.map((l) => [l.creditId, l._sum.remainingKwh ?? new Decimal(0)]));
  const now = new Date();

  return credits
    .filter((c) => c.expiresAt > now && !UNSELLABLE_STATUSES.includes(c.status))
    .map((c) => ({
      ...c,
      // What the seller may actually list right now — the Sell page must offer
      // this, not availableKwh, or it advertises a ceiling the server rejects.
      listableKwh: new Decimal(c.availableKwh).minus(listedByCredit.get(c.id) ?? new Decimal(0)),
    }))
    .filter((c) => c.listableKwh.gt(0));
}

export async function getCreditById(user: AuthUser, id: string) {
  const credit = await prisma.energyCredit.findUnique({ where: { id } });
  if (!credit) throw ApiError.notFound("Credit not found");
  // Without this, any authenticated user could read any credit — and the row leaks
  // sourceMeterId and readingId, the exact ids needed to attack the meter endpoints.
  assertCanRead(user, credit.ownerId, "Credit");
  return credit;
}
