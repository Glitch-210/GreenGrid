import crypto from "crypto";
import { prisma } from "../../config/prisma";
import { Decimal } from "../../lib/decimal";
import { ApiError } from "../../lib/ApiError";
import { CLOCK_SKEW_MINUTES, GENERATION_RATED_MULTIPLIER, GENERATION_MEDIAN_MULTIPLIER, TRAILING_READING_WINDOW } from "../../config/constants";
import type { CreateMeterInput, IngestReadingInput } from "@wattshare/shared";
import type { AuthUser } from "../../middleware/auth.middleware";

export async function createMeter(user: AuthUser, input: CreateMeterInput) {
  return prisma.meter.create({
    data: {
      meterNumber: input.meterNumber,
      userId: user.id,
      gridZoneId: input.gridZoneId,
      meterType: input.meterType,
      ratedKw: input.ratedKw ?? 1,
    },
  });
}

export async function listReadings(meterId: string, page: number, pageSize: number) {
  const [items, total] = await Promise.all([
    prisma.meterReading.findMany({
      where: { meterId },
      orderBy: { timestamp: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.meterReading.count({ where: { meterId } }),
  ]);
  return { items, total, page, pageSize };
}

function payloadHash(meterId: string, externalId: string, timestamp: Date, gen: string, cons: string) {
  return crypto.createHash("sha256").update(`${meterId}|${externalId}|${timestamp.toISOString()}|${gen}|${cons}`).digest("hex");
}

/**
 * Ingest + validate one reading per the spec in IMPLEMENTATION_PLAN.md §5.1.
 * Returns the created (or pre-existing, on dedupe) reading.
 */
export async function ingestReading(meterId: string, input: IngestReadingInput) {
  const meter = await prisma.meter.findUnique({ where: { id: meterId } });
  if (!meter) throw ApiError.notFound("Meter not found");

  const generationKwh = new Decimal(input.generationKwh);
  const consumptionKwh = new Decimal(input.consumptionKwh);
  const hash = payloadHash(meterId, input.externalId, input.timestamp, generationKwh.toString(), consumptionKwh.toString());

  const existing = await prisma.meterReading.findFirst({
    where: { meterId, OR: [{ externalId: input.externalId }, { payloadHash: hash }] },
  });
  if (existing) return existing; // idempotent no-op — §5.1 dedupe

  if (meter.status !== "ACTIVE") {
    throw ApiError.badRequest("METER_NOT_ACTIVE", "Meter is not active");
  }

  const now = new Date();
  if (input.timestamp.getTime() > now.getTime() + CLOCK_SKEW_MINUTES * 60_000) {
    throw ApiError.badRequest("VALIDATION_ERROR", "Reading timestamp is too far in the future");
  }

  let status: "VERIFIED" | "FLAGGED" = "VERIFIED";
  let flagReason: string | null = null;

  const intervalHours = 0.25;
  const ratedCeiling = new Decimal(meter.ratedKw).times(intervalHours).times(GENERATION_RATED_MULTIPLIER);
  if (generationKwh.gt(ratedCeiling)) {
    status = "FLAGGED";
    flagReason = "GENERATION_EXCEEDS_RATED_CAPACITY";
  }

  if (status === "VERIFIED") {
    const trailing = await prisma.meterReading.findMany({
      where: { meterId },
      orderBy: { timestamp: "desc" },
      take: TRAILING_READING_WINDOW,
    });
    if (trailing.length >= 3) {
      const sorted = [...trailing.map((r) => Number(r.generationKwh))].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      if (median > 0 && generationKwh.gt(median * GENERATION_MEDIAN_MULTIPLIER)) {
        status = "FLAGGED";
        flagReason = "GENERATION_ANOMALY_VS_MEDIAN";
      }
    }
  }

  const surplusKwh = Decimal.max(0, generationKwh.minus(consumptionKwh));
  const importKwh = Decimal.max(0, consumptionKwh.minus(generationKwh));
  const exportKwh = surplusKwh;

  return prisma.meterReading.create({
    data: {
      meterId,
      externalId: input.externalId,
      timestamp: input.timestamp,
      generationKwh,
      consumptionKwh,
      importKwh,
      exportKwh,
      surplusKwh,
      status,
      flagReason,
      payloadHash: hash,
    },
  });
}
