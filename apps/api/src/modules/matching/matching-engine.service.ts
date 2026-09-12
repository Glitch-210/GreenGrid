import { prisma } from "../../config/prisma";
import { Decimal } from "../../lib/decimal";
import { computeMatchScore } from "../../lib/calculations";
import type { FindMatchesInput } from "@wattshare/shared";

export interface Allocation {
  listingId: string;
  sellerAlias: string;
  kwh: string;
  price: string;
  score: string;
}

export interface MatchResult {
  allocations: Allocation[];
  filledKwh: string;
  unfilledKwh: string;
  weightedAvgPrice: string;
}

/**
 * Greedy scored allocation across active listings. §5.5 of IMPLEMENTATION_PLAN.md.
 * unfilledKwh > 0 is not an error — the UI shows "N EC from P2P + M kWh from grid".
 */
export async function findMatches(buyerId: string, input: FindMatchesInput): Promise<MatchResult> {
  const buyerZone = await prisma.gridZone.findUniqueOrThrow({ where: { id: input.gridZoneId } });

  const candidates = await prisma.marketplaceListing.findMany({
    where: {
      status: { in: ["ACTIVE", "PARTIAL"] },
      remainingKwh: { gt: 0 },
      sellerId: { not: buyerId },
      credit: { expiresAt: { gt: new Date() } },
      ...(input.maxPrice !== undefined ? { pricePerKwh: { lte: input.maxPrice } } : {}),
      // zone eligibility (same zone or an eligible neighbour) is filtered in JS below,
      // since it needs buyerZone.neighbourCodes cross-referenced against each listing's zoneCode
    },
    include: { seller: { select: { displayAlias: true } }, zone: true },
  });

  const eligible = candidates.filter(
    (c) =>
      c.zone.status !== "OUTAGE" &&
      (c.gridZoneId === buyerZone.id || buyerZone.neighbourCodes.includes(c.zone.zoneCode)),
  );

  if (eligible.length === 0) {
    return { allocations: [], filledKwh: "0.0000", unfilledKwh: new Decimal(input.quantityKwh).toFixed(4), weightedAvgPrice: "0.0000" };
  }

  const prices = eligible.map((c) => new Decimal(c.pricePerKwh));
  const minPrice = Decimal.min(...prices);
  const maxPrice = Decimal.max(...prices);

  const scored = eligible
    .map((c) => ({
      listing: c,
      score: computeMatchScore({
        price: c.pricePerKwh,
        minPrice,
        maxPrice,
        sameZone: c.gridZoneId === buyerZone.id,
        remainingKwh: c.remainingKwh,
        requestedKwh: input.quantityKwh,
        congestion: congestionOf(c.zone.currentLoadKw, c.zone.capacityKw),
      }),
    }))
    .sort((a, b) => (b.score.eq(a.score) ? a.listing.pricePerKwh.cmp(b.listing.pricePerKwh) : b.score.cmp(a.score)));

  const allocations: Allocation[] = [];
  let remaining = new Decimal(input.quantityKwh);
  let totalCost = new Decimal(0);
  let filled = new Decimal(0);

  for (const { listing, score } of scored) {
    if (remaining.lte(0)) break;
    const take = Decimal.min(remaining, listing.remainingKwh);
    if (take.lte(0)) continue;

    allocations.push({
      listingId: listing.id,
      sellerAlias: listing.seller.displayAlias,
      kwh: take.toFixed(4),
      price: listing.pricePerKwh.toFixed(4),
      score: score.toFixed(4),
    });

    totalCost = totalCost.plus(take.times(listing.pricePerKwh));
    filled = filled.plus(take);
    remaining = remaining.minus(take);
  }

  const weightedAvgPrice = filled.gt(0) ? totalCost.div(filled) : new Decimal(0);

  return {
    allocations,
    filledKwh: filled.toFixed(4),
    unfilledKwh: remaining.toFixed(4),
    weightedAvgPrice: weightedAvgPrice.toFixed(4),
  };
}

function congestionOf(currentLoadKw: Decimal, capacityKw: Decimal): "LOW" | "MEDIUM" | "HIGH" {
  const utilisation = currentLoadKw.div(Decimal.max(capacityKw, new Decimal(0.0001))).toNumber();
  if (utilisation <= 0.7) return "LOW";
  if (utilisation <= 0.9) return "MEDIUM";
  return "HIGH";
}
