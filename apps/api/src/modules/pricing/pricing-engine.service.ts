import { prisma } from "../../config/prisma";
import { Decimal } from "../../lib/decimal";
import { computeFinalPrice } from "../../lib/calculations";
import { emitToZone } from "../../sockets/io";
import { SOCKET_EVENTS } from "../../sockets/events";

/** Recompute and persist the dynamic price for every zone. §5.3, cron every 20s. */
export async function runPricingTick() {
  const zones = await prisma.gridZone.findMany();

  for (const zone of zones) {
    const supplyAgg = await prisma.marketplaceListing.aggregate({
      where: { gridZoneId: zone.id, status: { in: ["ACTIVE", "PARTIAL"] } },
      _sum: { remainingKwh: true },
    });
    const supplyKwh = supplyAgg._sum.remainingKwh ?? new Decimal(0);

    const fifteenMinAgo = new Date(Date.now() - 15 * 60_000);
    const demandAgg = await prisma.energyMatch.aggregate({
      where: { gridZoneId: zone.id, createdAt: { gte: fifteenMinAgo } },
      _sum: { quantityKwh: true },
    });
    const demandKwh = demandAgg._sum.quantityKwh ?? new Decimal(0.0001);

    const { demandFactor, supplyFactor, congestionFactor, finalPrice } = computeFinalPrice({
      basePrice: zone.basePrice,
      supplyKwh,
      demandKwh,
      currentLoadKw: zone.currentLoadKw,
      capacityKw: zone.capacityKw,
      priceFloor: zone.priceFloor,
      priceCeiling: zone.priceCeiling,
    });

    await prisma.energyPrice.create({
      data: {
        gridZoneId: zone.id,
        basePrice: zone.basePrice,
        demandFactor,
        supplyFactor,
        congestionFactor,
        finalPrice,
      },
    });

    emitToZone(zone.id, SOCKET_EVENTS.PRICE_UPDATE, {
      gridZoneId: zone.id,
      finalPrice: finalPrice.toFixed(4),
      demandFactor: demandFactor.toFixed(4),
      supplyFactor: supplyFactor.toFixed(4),
      congestionFactor: congestionFactor.toFixed(4),
    });
  }
}

export async function getCurrentPrice(zoneId: string) {
  return prisma.energyPrice.findFirst({ where: { gridZoneId: zoneId }, orderBy: { timestamp: "desc" } });
}

export async function getPriceHistory(zoneId: string, hours: number) {
  const since = new Date(Date.now() - hours * 3_600_000);
  return prisma.energyPrice.findMany({
    where: { gridZoneId: zoneId, timestamp: { gte: since } },
    orderBy: { timestamp: "asc" },
  });
}
