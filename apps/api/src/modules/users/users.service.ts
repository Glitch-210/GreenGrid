import { prisma } from "../../config/prisma";
import { Decimal } from "../../lib/decimal";
import { env } from "../../config/env";
import { getSellerTotals } from "../transactions/seller-earnings.service";
import type { AuthUser } from "../../middleware/auth.middleware";

export async function getDashboard(user: AuthUser) {
  if (user.role === "PROSUMER") return prosumerDashboard(user.id);
  if (user.role === "CONSUMER") return consumerDashboard(user.id);
  if (user.role === "UTILITY") return utilityDashboard();
  if (user.role === "REGULATOR") return regulatorDashboard();
  return adminDashboard();
}

async function prosumerDashboard(userId: string) {
  const credits = await prisma.energyCredit.findMany({ where: { ownerId: userId } });
  const totals = credits.reduce(
    (acc, c) => {
      acc.available = acc.available.plus(c.availableKwh);
      acc.reserved = acc.reserved.plus(c.reservedKwh);
      acc.sold = acc.sold.plus(c.soldKwh);
      acc.retired = acc.retired.plus(c.retiredKwh);
      return acc;
    },
    { available: new Decimal(0), reserved: new Decimal(0), sold: new Decimal(0), retired: new Decimal(0) },
  );

  // Via EnergyMatch, not Transaction.sellerId — the latter is null for multi-seller
  // baskets, which silently dropped those sales from the seller's earnings.
  const sellerTotals = await getSellerTotals(userId);

  return {
    role: "PROSUMER",
    creditBalance: {
      available: totals.available.toFixed(4),
      reserved: totals.reserved.toFixed(4),
      sold: totals.sold.toFixed(4),
      retired: totals.retired.toFixed(4),
    },
    totalEarnings: sellerTotals.earnings.toFixed(4),
    creditCount: credits.length,
    // Sent so the Sell page can quote the fee and net payout from the same rate
    // the settlement engine will actually apply.
    platformFeeRate: env.platformFeeRate.toString(),
  };
}

async function consumerDashboard(userId: string) {
  const txns = await prisma.transaction.findMany({ where: { buyerId: userId } });
  const totalSpent = txns.reduce((sum, t) => sum.plus(t.totalAmount), new Decimal(0));
  const totalKwh = txns.reduce((sum, t) => sum.plus(t.quantityKwh), new Decimal(0));

  const settlements = await prisma.settlement.findMany({ where: { consumerId: userId } });
  const totalBillAdjustment = settlements.reduce((sum, s) => sum.plus(s.billAdjustment), new Decimal(0));

  return {
    role: "CONSUMER",
    totalPurchasedKwh: totalKwh.toFixed(4),
    totalSpent: totalSpent.toFixed(4),
    totalBillAdjustment: totalBillAdjustment.toFixed(4),
    transactionCount: txns.length,
  };
}

async function utilityDashboard() {
  const zones = await prisma.gridZone.findMany();
  const settlementQueue = await prisma.settlement.count({ where: { status: "PENDING" } });
  const totalTraded = await prisma.transaction.aggregate({
    where: { status: { in: ["COMPLETED", "SETTLED"] } },
    _sum: { quantityKwh: true },
  });

  return {
    role: "UTILITY",
    zones: zones.map((z) => ({
      zoneCode: z.zoneCode,
      name: z.name,
      capacityKw: z.capacityKw.toFixed(4),
      currentLoadKw: z.currentLoadKw.toFixed(4),
      status: z.status,
    })),
    settlementQueueSize: settlementQueue,
    totalP2PTradedKwh: (totalTraded._sum.quantityKwh ?? new Decimal(0)).toFixed(4),
  };
}

async function adminDashboard() {
  const [userCount, txnCount, flaggedReadings, mismatches] = await Promise.all([
    prisma.user.count(),
    prisma.transaction.count(),
    prisma.meterReading.count({ where: { status: "FLAGGED" } }),
    prisma.settlement.count({ where: { status: "MISMATCH" } }),
  ]);

  return {
    role: "ADMIN",
    userCount,
    transactionCount: txnCount,
    flaggedReadings,
    settlementMismatches: mismatches,
  };
}

async function regulatorDashboard() {
  const [userCount, txnCount, flaggedReadings, mismatches, zones, creditsAgg, activeListings, flaggedMeters] =
    await Promise.all([
      prisma.user.count(),
      prisma.transaction.count(),
      prisma.meterReading.count({ where: { status: "FLAGGED" } }),
      prisma.settlement.count({ where: { status: "MISMATCH" } }),
      prisma.gridZone.findMany(),
      prisma.energyCredit.aggregate({ _sum: { quantityKwh: true, soldKwh: true, retiredKwh: true } }),
      prisma.marketplaceListing.count({ where: { status: "ACTIVE" } }),
      prisma.meter.findMany({
        where: { status: "FLAGGED" },
        include: {
          user: { select: { name: true, displayAlias: true, email: true } },
          gridZone: { select: { zoneCode: true, name: true } },
        },
      }),
    ]);

  return {
    role: "REGULATOR",
    userCount,
    transactionCount: txnCount,
    flaggedReadings,
    settlementMismatches: mismatches,
    activeListings,
    flaggedMetersCount: flaggedMeters.length,
    flaggedMeters: flaggedMeters.map((m) => ({
      id: m.id,
      meterNumber: m.meterNumber,
      userAlias: m.user.displayAlias,
      userEmail: m.user.email,
      zoneCode: m.gridZone.zoneCode,
      zoneName: m.gridZone.name,
      status: m.status,
      ratedKw: m.ratedKw.toFixed(2),
    })),
    totalMintedKwh: (creditsAgg._sum.quantityKwh ?? new Decimal(0)).toFixed(4),
    totalSoldKwh: (creditsAgg._sum.soldKwh ?? new Decimal(0)).toFixed(4),
    totalRetiredKwh: (creditsAgg._sum.retiredKwh ?? new Decimal(0)).toFixed(4),
    zones: zones.map((z) => ({
      id: z.id,
      zoneCode: z.zoneCode,
      name: z.name,
      capacityKw: z.capacityKw.toFixed(4),
      currentLoadKw: z.currentLoadKw.toFixed(4),
      basePrice: z.basePrice.toFixed(4),
      priceFloor: z.priceFloor.toFixed(4),
      priceCeiling: z.priceCeiling.toFixed(4),
      status: z.status,
    })),
  };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      meters: {
        include: {
          gridZone: { select: { zoneCode: true, name: true } },
        },
      },
    },
  });
  if (!user) return null;
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

