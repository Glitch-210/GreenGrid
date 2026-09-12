import { prisma } from "../../config/prisma";
import { Decimal } from "../../lib/decimal";
import { ApiError } from "../../lib/ApiError";
import { audit } from "../../lib/audit";
import { nextCreditId } from "../../lib/ids";
import { eligibleCreditKwh } from "../../lib/calculations";
import { env } from "../../config/env";
import { logger } from "../../lib/logger";
import { enqueueChainOp } from "../../adapters/chain/queue";
import { pseudoAddress } from "../../adapters/chain/chain.service";
import { emitToUser } from "../../sockets/io";
import { SOCKET_EVENTS } from "../../sockets/events";
import { assertOwns, assertCanRead } from "../../lib/authorize";
import type { AuthUser } from "../../middleware/auth.middleware";
import type { CreditStatus } from "@prisma/client";

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
      // The reading is consumed either way, but no credit exists. The caller is
      // told so explicitly rather than handed a null that reads as a mint.
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

interface CreditBalance {
  id?: string;
  creditId?: string;
  quantityKwh: Decimal;
  availableKwh: Decimal;
  reservedKwh: Decimal;
  soldKwh: Decimal;
  retiredKwh: Decimal;
}

/**
 * available + reserved + sold + retired == quantity, available/reserved >= 0.
 *
 * This is the alarm for the precision bugs; it has to be legible when it fires.
 * A raw Error was mapped to an anonymous 500 INTERNAL_ERROR by
 * error.middleware.ts with no code and no way to tell which credit broke, so it
 * throws a named ApiError carrying the full breakdown and logs at error level.
 */
function assertInvariant(c: CreditBalance) {
  const sum = new Decimal(c.availableKwh).plus(c.reservedKwh).plus(c.soldKwh).plus(c.retiredKwh);
  const negative = c.availableKwh.lt(0) || c.reservedKwh.lt(0);
  if (sum.equals(c.quantityKwh) && !negative) return;

  const details = {
    creditRowId: c.id ?? null,
    creditId: c.creditId ?? null,
    quantityKwh: c.quantityKwh.toString(),
    availableKwh: c.availableKwh.toString(),
    reservedKwh: c.reservedKwh.toString(),
    soldKwh: c.soldKwh.toString(),
    retiredKwh: c.retiredKwh.toString(),
    sum: sum.toString(),
    delta: sum.minus(c.quantityKwh).toString(),
    reason: negative ? "NEGATIVE_BALANCE" : "SUM_MISMATCH",
  };
  logger.error("Credit balance invariant violated", details);
  throw ApiError.internal(
    "CREDIT_INVARIANT_VIOLATION",
    negative
      ? "Credit balance went negative"
      : `Credit balance invariant violated: ${sum.toString()} != ${c.quantityKwh.toString()}`,
    details,
  );
}

/** Statuses in which a credit can never be sold, whatever its balance says. */
const UNSELLABLE_STATUSES: CreditStatus[] = ["FROZEN", "EXPIRED", "RETIRED", "SETTLED"];

/** The fields the sellable predicate reads — any credit row satisfies this. */
interface SellableInput {
  id: string;
  availableKwh: Decimal;
  expiresAt: Date;
  status: CreditStatus;
}

/**
 * How much of each credit open listings have already spoken for. Exported so
 * every caller of `selectSellable` feeds it the same numbers.
 */
export async function listedRemainderByCredit(creditIds: string[]): Promise<Map<string, Decimal>> {
  if (creditIds.length === 0) return new Map();
  const listed = await prisma.marketplaceListing.groupBy({
    by: ["creditId"],
    where: { creditId: { in: creditIds }, status: { in: ["ACTIVE", "PARTIAL"] } },
    _sum: { remainingKwh: true },
  });
  return new Map(listed.map((l) => [l.creditId, l._sum.remainingKwh ?? new Decimal(0)]));
}

/**
 * The one definition of "sellable", shared by the Sell page's batch list and the
 * dashboard's headline figure — two screens quoting two different predicates is
 * how they came to contradict each other.
 *
 * A credit's availableKwh does NOT drop when it is listed (only a buyer's
 * reservation moves balance — §5.6), so "how much can I still list?" is
 * availableKwh minus what open listings already spoke for. Anything with a
 * positive remainder is sellable regardless of status.
 */
export function selectSellable<T extends SellableInput>(
  credits: T[],
  listedByCredit: Map<string, Decimal>,
  now = new Date(),
): Array<T & { listableKwh: Decimal }> {
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

/** Total kWh the owner could list right now, over the credits given. */
export async function sellableTotal(credits: SellableInput[]): Promise<Decimal> {
  const listedByCredit = await listedRemainderByCredit(credits.map((c) => c.id));
  return selectSellable(credits, listedByCredit).reduce((sum, c) => sum.plus(c.listableKwh), new Decimal(0));
}

export async function listCreditsForOwner(ownerId: string, status?: CreditStatus, sellable?: boolean) {
  const credits = await prisma.energyCredit.findMany({
    where: { ownerId, ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
  });
  if (!sellable) return credits;

  return selectSellable(credits, await listedRemainderByCredit(credits.map((c) => c.id)));
}

export async function getCreditById(user: AuthUser, id: string) {
  const credit = await prisma.energyCredit.findUnique({ where: { id } });
  if (!credit) throw ApiError.notFound("Credit not found");
  // Without this, any authenticated user could read any credit — and the row leaks
  // sourceMeterId and readingId, the exact ids needed to attack the meter endpoints.
  assertCanRead(user, credit.ownerId, "Credit");
  return credit;
}
