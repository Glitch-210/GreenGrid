import { prisma } from "../config/prisma";
import { Decimal } from "../lib/decimal";
import { logger } from "../lib/logger";

/**
 * Retire credits and listings past their validity window. §5.1
 *
 * Nothing previously acted on `expiresAt`: it was computed at mint, copied onto the
 * listing, shown to the seller, and then only ever checked at the very last moment
 * (reservation). So an expired credit stayed listable and its stale listing sat in
 * the marketplace looking live, failing for the *buyer* at purchase time.
 *
 * Credits mid-trade are left alone — `reservedKwh > 0` means a buyer is holding
 * them and that reservation has its own TTL (`env.reservationTtlMinutes`). Expiring
 * underneath an in-flight purchase would strand the transaction.
 */
export async function runExpiryTick() {
  const now = new Date();

  const expiredListings = await prisma.marketplaceListing.updateMany({
    where: { expiresAt: { lt: now }, status: { in: ["ACTIVE", "PARTIAL"] } },
    data: { status: "EXPIRED" },
  });

  // Load rather than updateMany: the reserved/retired filters below need per-row
  // Decimal comparisons that don't express cleanly as a Prisma filter.
  const candidates = await prisma.energyCredit.findMany({
    where: {
      expiresAt: { lt: now },
      status: { notIn: ["EXPIRED", "RETIRED", "SETTLED"] },
    },
    select: { id: true, creditId: true, availableKwh: true, reservedKwh: true },
  });

  const stale = candidates.filter(
    (c) => new Decimal(c.reservedKwh).lte(0) && new Decimal(c.availableKwh).gt(0),
  );

  if (stale.length > 0) {
    await prisma.energyCredit.updateMany({
      where: { id: { in: stale.map((c) => c.id) } },
      data: { status: "EXPIRED" },
    });
  }

  if (expiredListings.count > 0 || stale.length > 0) {
    logger.info("Expiry tick", { listings: expiredListings.count, credits: stale.length });
  }

  return { listings: expiredListings.count, credits: stale.length };
}
