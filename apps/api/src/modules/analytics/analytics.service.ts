import { prisma } from "../../config/prisma";
import { Decimal } from "../../lib/decimal";

export async function marketAnalytics() {
  const [txnAgg, priceLatest, flagged, mismatches] = await Promise.all([
    prisma.transaction.aggregate({
      where: { status: { in: ["COMPLETED", "SETTLED"] } },
      _sum: { quantityKwh: true, totalAmount: true },
      _count: true,
    }),
    prisma.energyPrice.findMany({ orderBy: { timestamp: "desc" }, take: 20 }),
    prisma.meterReading.count({ where: { status: "FLAGGED" } }),
    prisma.settlement.count({ where: { status: "MISMATCH" } }),
  ]);

  return {
    totalVolumeKwh: (txnAgg._sum.quantityKwh ?? new Decimal(0)).toFixed(4),
    totalValue: (txnAgg._sum.totalAmount ?? new Decimal(0)).toFixed(4),
    transactionCount: txnAgg._count,
    recentPrices: priceLatest,
    flaggedReadings: flagged,
    settlementMismatches: mismatches,
  };
}

export async function myAnalytics(userId: string) {
  const [asSeller, asBuyer] = await Promise.all([
    prisma.transaction.aggregate({ where: { sellerId: userId }, _sum: { sellerPayout: true, quantityKwh: true } }),
    prisma.transaction.aggregate({ where: { buyerId: userId }, _sum: { totalAmount: true, quantityKwh: true } }),
  ]);

  return {
    soldKwh: (asSeller._sum.quantityKwh ?? new Decimal(0)).toFixed(4),
    earnings: (asSeller._sum.sellerPayout ?? new Decimal(0)).toFixed(4),
    boughtKwh: (asBuyer._sum.quantityKwh ?? new Decimal(0)).toFixed(4),
    spent: (asBuyer._sum.totalAmount ?? new Decimal(0)).toFixed(4),
  };
}
