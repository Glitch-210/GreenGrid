import { prisma } from "../../config/prisma";
import { Decimal } from "../../lib/decimal";
import { ApiError } from "../../lib/ApiError";
import { congestionFromUtilisation } from "../../lib/calculations";

export async function listZones() {
  return prisma.gridZone.findMany();
}

export async function getZoneStatus(zoneId: string) {
  const zone = await prisma.gridZone.findUnique({ where: { id: zoneId } });
  if (!zone) throw ApiError.notFound("Grid zone not found");

  const availableCapacityKw = Decimal.max(0, new Decimal(zone.capacityKw).minus(zone.currentLoadKw));
  const ratio = availableCapacityKw.div(Decimal.max(zone.capacityKw, new Decimal(0.0001))).toNumber();
  const congestionLevel = congestionFromUtilisation(ratio);

  return {
    gridZoneId: zone.id,
    zoneCode: zone.zoneCode,
    loadKw: zone.currentLoadKw.toFixed(4),
    capacityKw: zone.capacityKw.toFixed(4),
    availableCapacityKw: availableCapacityKw.toFixed(4),
    congestionLevel,
    status: zone.status,
  };
}

export interface TradeCheckResult {
  ok: boolean;
  reason?: "ZONE_OUTAGE" | "GRID_CONGESTED";
  maxAllowedKwh?: string;
}

/** §5.4 — the gate every transaction must pass before reservation. */
export async function canTrade(zoneId: string, kwh: Decimal.Value): Promise<TradeCheckResult> {
  const zone = await prisma.gridZone.findUnique({ where: { id: zoneId } });
  if (!zone) throw ApiError.notFound("Grid zone not found");

  if (zone.status === "OUTAGE") {
    return { ok: false, reason: "ZONE_OUTAGE" };
  }

  const availableCapacityKw = Decimal.max(0, new Decimal(zone.capacityKw).minus(zone.currentLoadKw));
  if (new Decimal(kwh).gt(availableCapacityKw)) {
    return { ok: false, reason: "GRID_CONGESTED", maxAllowedKwh: availableCapacityKw.toFixed(4) };
  }

  return { ok: true };
}
