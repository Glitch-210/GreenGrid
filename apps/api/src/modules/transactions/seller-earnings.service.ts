import { prisma } from "../../config/prisma";
import { Decimal } from "../../lib/decimal";
import { env } from "../../config/env";
import { SELLER_EARNED_STATUSES } from "../../config/constants";

/**
 * Seller-side totals, computed from EnergyMatch rather than Transaction.
 *
 * `Transaction.sellerId` is null whenever a purchase spans more than one listing
 * (transactions.service.ts — a multi-seller basket has no single seller), so any
 * query filtering on it silently drops those sales. EnergyMatch is the correct
 * grain: one row per listing filled, each carrying its own sellerId, quantity and
 * price. One transaction can yield several matches for the SAME seller, so these
 * are summed, never de-duplicated.
 *
 * The payout is derived per match — quantity * price * (1 - fee) — instead of read
 * from `Transaction.sellerPayout`, which is the whole basket's payout across all
 * sellers and would over-credit each of them.
 */
export async function getSellerTotals(userId: string) {
  const earnedStatus = { status: { in: [...SELLER_EARNED_STATUSES] } };

  const [matches, unmatched] = await Promise.all([
    prisma.energyMatch.findMany({
      where: { sellerId: userId, transaction: earnedStatus },
      select: { quantityKwh: true, pricePerKwh: true },
    }),
    // Transactions that carry a sellerId but no match rows at all. Seeded demo
    // history is written this way, and any row predating the matching engine
    // would be too — without this they'd silently report as zero earnings.
    prisma.transaction.findMany({
      where: { sellerId: userId, matches: { none: {} }, ...earnedStatus },
      select: { quantityKwh: true, sellerPayout: true },
    }),
  ]);

  const feeMultiplier = new Decimal(1).minus(env.platformFeeRate);

  const fromMatches = matches.reduce(
    (acc, m) => {
      // Derived per match, not read from Transaction.sellerPayout — that column is
      // the whole basket's payout across every seller, so using it here would
      // over-credit each one of them.
      const gross = new Decimal(m.quantityKwh).times(m.pricePerKwh);
      return {
        soldKwh: acc.soldKwh.plus(m.quantityKwh),
        earnings: acc.earnings.plus(gross.times(feeMultiplier)),
      };
    },
    { soldKwh: new Decimal(0), earnings: new Decimal(0) },
  );

  // Single-seller by definition (no matches to split), so the stored payout is
  // wholly theirs and is used as-is — it reflects the fee rate in force at the time.
  return unmatched.reduce(
    (acc, t) => ({
      soldKwh: acc.soldKwh.plus(t.quantityKwh),
      earnings: acc.earnings.plus(t.sellerPayout),
    }),
    fromMatches,
  );
}
