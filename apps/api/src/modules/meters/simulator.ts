import { prisma } from "../../config/prisma";
import { bellCurve, jitter } from "../../lib/calculations";
import { Decimal } from "../../lib/decimal";
import { logger } from "../../lib/logger";
import { advanceSimulatedClock } from "./simulated-clock";
import { ingestReadingUnchecked } from "./meters.service";
import { mintFromReading } from "../credits/credit-engine.service";
import { emitToZone } from "../../sockets/io";
import { SOCKET_EVENTS } from "../../sockets/events";

/** Rough per-user hourly consumption shape (kW), repeats daily. Index = hour 0..23. */
const CONSUMPTION_PROFILE_KW = [0.3, 0.3, 0.3, 0.3, 0.4, 0.5, 0.8, 1.2, 1.0, 0.8, 0.7, 0.7, 0.8, 0.8, 0.7, 0.7, 0.9, 1.3, 1.8, 1.6, 1.2, 0.8, 0.5, 0.4];

/**
 * One simulator tick = one simulated 15-min interval, per IMPLEMENTATION_PLAN.md §5.2.
 * For every SOLAR/BIDIRECTIONAL meter: synthesize a reading via a solar bell curve,
 * ingest it (auto-verifies unless anomalous), and auto-mint credits when verified.
 */
export async function runSimulatorTick() {
  const simulatedTime = advanceSimulatedClock();
  const hour = simulatedTime.getUTCHours();
  const solarK = bellCurve(hour);

  const meters = await prisma.meter.findMany({
    where: { meterType: { in: ["SOLAR", "BIDIRECTIONAL"] }, status: "ACTIVE" },
    include: { gridZone: true },
  });

  for (const meter of meters) {
    const ratedKw = new Decimal(meter.ratedKw);
    const gen = ratedKw.times(solarK).times(jitter(0.9, 1.1)).times(0.25);
    const consumptionKw = CONSUMPTION_PROFILE_KW[hour] * jitter(0.85, 1.15);
    const cons = new Decimal(consumptionKw).times(0.25);

    const externalId = `SIM-${meter.id}-${simulatedTime.getTime()}`;

    try {
      const reading = await ingestReadingUnchecked(meter.id, {
        externalId,
        timestamp: simulatedTime,
        generationKwh: gen.toNumber(),
        consumptionKwh: cons.toNumber(),
      });

      if (reading.status === "VERIFIED" && !reading.creditIssued) {
        await mintFromReading(reading.id);
      }

      emitToZone(meter.gridZoneId, SOCKET_EVENTS.ENERGY_UPDATE, {
        meterId: meter.id,
        generationKwh: gen.toFixed(4),
        consumptionKwh: cons.toFixed(4),
        timestamp: simulatedTime.toISOString(),
      });
    } catch (err) {
      logger.warn("Simulator tick failed for meter", { meterId: meter.id, error: String(err) });
    }
  }
}

export { CONSUMPTION_PROFILE_KW };
