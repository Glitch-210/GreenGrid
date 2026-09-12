import { prisma } from "../../config/prisma";
import { Decimal } from "../../lib/decimal";
import { SELLER_EARNED_STATUSES } from "../../config/constants";
import { getSellerTotals } from "../transactions/seller-earnings.service";

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
  // Seller side goes through EnergyMatch and the shared earned-status list. The old
  // Transaction.sellerId aggregate had no status filter at all, so CANCELLED and
  // PAYMENT_FAILED trades counted as income — and it disagreed with /users/dashboard.
  const [sellerTotals, asBuyer] = await Promise.all([
    getSellerTotals(userId),
    prisma.transaction.aggregate({
      where: { buyerId: userId, status: { in: [...SELLER_EARNED_STATUSES] } },
      _sum: { totalAmount: true, quantityKwh: true },
    }),
  ]);

  return {
    soldKwh: sellerTotals.soldKwh.toFixed(4),
    earnings: sellerTotals.earnings.toFixed(4),
    boughtKwh: (asBuyer._sum.quantityKwh ?? new Decimal(0)).toFixed(4),
    spent: (asBuyer._sum.totalAmount ?? new Decimal(0)).toFixed(4),
  };
}
