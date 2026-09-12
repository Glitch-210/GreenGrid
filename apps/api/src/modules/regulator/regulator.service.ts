import { prisma } from "../../config/prisma";
import { Decimal } from "../../lib/decimal";
import { audit } from "../../lib/audit";
import { ApiError } from "../../lib/ApiError";
import type { MeterStatus, SettleStatus } from "@prisma/client";
import type { AuthUser } from "../../middleware/auth.middleware";

export async function checkInvariants() {
  const credits = await prisma.energyCredit.findMany();
  let violations = 0;
  const violationDetails: string[] = [];

  let totalAvailable = new Decimal(0);
  let totalReserved = new Decimal(0);
  let totalSold = new Decimal(0);
  let totalRetired = new Decimal(0);
  let totalQuantity = new Decimal(0);

  for (const c of credits) {
    const sum = new Decimal(c.availableKwh).plus(c.reservedKwh).plus(c.soldKwh).plus(c.retiredKwh);
    totalAvailable = totalAvailable.plus(c.availableKwh);
    totalReserved = totalReserved.plus(c.reservedKwh);
    totalSold = totalSold.plus(c.soldKwh);
    totalRetired = totalRetired.plus(c.retiredKwh);
    totalQuantity = totalQuantity.plus(c.quantityKwh);

    if (!sum.equals(c.quantityKwh)) {
      violations++;
      violationDetails.push(`Balance mismatch on ${c.creditId}: sum=${sum} != qty=${c.quantityKwh}`);
    }
    if (new Decimal(c.availableKwh).lt(0) || new Decimal(c.reservedKwh).lt(0)) {
      violations++;
      violationDetails.push(`Negative balance on ${c.creditId}`);
    }
  }

  const soldAgg = await prisma.energyCredit.aggregate({ _sum: { soldKwh: true } });
  const settledAgg = await prisma.settlement.aggregate({ _sum: { settledKwh: true } });

  return {
    compliant: violations === 0,
    violationsCount: violations,
    totalCreditsChecked: credits.length,
    violationDetails,
    summary: {
      availableKwh: totalAvailable.toFixed(4),
      reservedKwh: totalReserved.toFixed(4),
      soldKwh: totalSold.toFixed(4),
      retiredKwh: totalRetired.toFixed(4),
      totalQuantityKwh: totalQuantity.toFixed(4),
      totalSettledKwh: (settledAgg._sum.settledKwh ?? new Decimal(0)).toFixed(4),
      totalSoldAggregateKwh: (soldAgg._sum.soldKwh ?? new Decimal(0)).toFixed(4),
    },
    checkedAt: new Date().toISOString(),
  };
}

export async function listAllMeters() {
  const meters = await prisma.meter.findMany({
    include: {
      user: { select: { name: true, displayAlias: true, email: true, role: true } },
      gridZone: { select: { id: true, zoneCode: true, name: true } },
      _count: { select: { readings: true, credits: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return meters.map((m) => ({
    id: m.id,
    meterNumber: m.meterNumber,
    meterType: m.meterType,
    status: m.status,
    ratedKw: m.ratedKw.toFixed(2),
    installedAt: m.installedAt.toISOString(),
    ownerName: m.user.name,
    ownerAlias: m.user.displayAlias,
    ownerEmail: m.user.email,
    ownerRole: m.user.role,
    gridZoneCode: m.gridZone.zoneCode,
    gridZoneName: m.gridZone.name,
    readingsCount: m._count.readings,
    creditsCount: m._count.credits,
  }));
}

export async function updateMeterStatus(admin: AuthUser, meterId: string, status: MeterStatus, reason?: string) {
  const meter = await prisma.meter.findUnique({ where: { id: meterId } });
  if (!meter) throw ApiError.notFound("Meter not found");

  const updated = await prisma.meter.update({
    where: { id: meterId },
    data: { status },
    include: {
      user: { select: { name: true, displayAlias: true, email: true } },
      gridZone: { select: { zoneCode: true, name: true } },
    },
  });

  await audit(prisma, "REGULATOR_METER_STATUS_UPDATE", "Meter", meterId, admin.id, {
    oldStatus: meter.status,
    newStatus: status,
    reason: reason || "Regulator intervention",
    meterNumber: meter.meterNumber,
  });

  return updated;
}

export async function listAllSettlements(statusFilter?: string) {
  const where = statusFilter && statusFilter !== "ALL" ? { status: statusFilter as SettleStatus } : {};
  return prisma.settlement.findMany({
    where,
    include: {
      transaction: {
        include: {
          buyer: { select: { name: true, displayAlias: true, email: true } },
          seller: { select: { name: true, displayAlias: true, email: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function reconcileSettlement(
  admin: AuthUser,
  settlementId: string,
  resolution: { billAdjustment?: number; notes?: string },
) {
  const settlement = await prisma.settlement.findUnique({
    where: { id: settlementId },
    include: { transaction: true },
  });
  if (!settlement) throw ApiError.notFound("Settlement not found");

  const updated = await prisma.settlement.update({
    where: { id: settlementId },
    data: {
      status: "SETTLED",
      settledKwh: settlement.requestedKwh,
      billAdjustment: resolution.billAdjustment ? new Decimal(resolution.billAdjustment) : settlement.billAdjustment,
      settledAt: new Date(),
    },
  });

  if (settlement.transaction.status !== "COMPLETED") {
    await prisma.transaction.update({
      where: { id: settlement.transactionId },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
  }

  await audit(prisma, "REGULATOR_SETTLEMENT_RECONCILED", "Settlement", settlementId, admin.id, {
    originalStatus: settlement.status,
    resolution: resolution.notes || "Regulatory reconciliation approved",
    settledKwh: settlement.requestedKwh.toFixed(4),
  });

  return updated;
}

export async function updateZoneTariffs(
  admin: AuthUser,
  zoneId: string,
  tariffs: { basePrice?: number; priceFloor?: number; priceCeiling?: number },
) {
  const zone = await prisma.gridZone.findUnique({ where: { id: zoneId } });
  if (!zone) throw ApiError.notFound("Grid Zone not found");

  const data: any = {};
  if (tariffs.basePrice !== undefined) data.basePrice = new Decimal(tariffs.basePrice);
  if (tariffs.priceFloor !== undefined) data.priceFloor = new Decimal(tariffs.priceFloor);
  if (tariffs.priceCeiling !== undefined) data.priceCeiling = new Decimal(tariffs.priceCeiling);

  const updated = await prisma.gridZone.update({
    where: { id: zoneId },
    data,
  });

  await audit(prisma, "REGULATOR_TARIFF_UPDATE", "GridZone", zoneId, admin.id, {
    zoneCode: zone.zoneCode,
    previous: {
      basePrice: zone.basePrice.toFixed(4),
      priceFloor: zone.priceFloor.toFixed(4),
      priceCeiling: zone.priceCeiling.toFixed(4),
    },
    updated: {
      basePrice: updated.basePrice.toFixed(4),
      priceFloor: updated.priceFloor.toFixed(4),
      priceCeiling: updated.priceCeiling.toFixed(4),
    },
  });

  return updated;
}

export async function listAllTransactions() {
  return prisma.transaction.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      buyer: { select: { name: true, displayAlias: true, email: true } },
      seller: { select: { name: true, displayAlias: true, email: true } },
      payment: true,
      settlement: true,
    },
  });
}
