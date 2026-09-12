import { Decimal } from "decimal.js";
import { PRICING, CONGESTION_SCORE, MATCH_WEIGHTS } from "../config/constants";
import { clamp, round4 } from "./decimal";

/** Bell curve solar output shape, 0..1, peaking at `peak` hour with std-dev-ish `width`. §5.2 */
export function bellCurve(hour: number, peak = 13, width = 3.2): number {
  const exponent = -((hour - peak) ** 2) / (2 * width * width);
  return Math.max(0, Math.exp(exponent));
}

export function jitter(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Eligible EC from a reading's surplus, after grid loss factor. §5.1 */
export function eligibleCreditKwh(generationKwh: Decimal.Value, consumptionKwh: Decimal.Value, lossFactor: Decimal.Value): Decimal {
  const gross = Decimal.max(0, new Decimal(generationKwh).minus(consumptionKwh));
  return round4(gross.times(lossFactor));
}

/** Dynamic pricing formula. §5.3 */
export function computeFinalPrice(params: {
  basePrice: Decimal.Value;
  supplyKwh: Decimal.Value;
  demandKwh: Decimal.Value;
  currentLoadKw: Decimal.Value;
  capacityKw: Decimal.Value;
  priceFloor: Decimal.Value;
  priceCeiling: Decimal.Value;
}) {
  const supply = new Decimal(params.supplyKwh);
  const demand = new Decimal(params.demandKwh);
  const epsilon = new Decimal(0.0001);

  const ratio = demand.div(Decimal.max(supply, epsilon));
  const demandFactor = clamp(
    ratio.minus(1).times(PRICING.demandFactorK),
    PRICING.demandFactorMin,
    PRICING.demandFactorMax,
  );

  const supplyRatio = demand.gt(0) ? supply.div(demand).minus(1) : new Decimal(0);
  const supplyFactor = clamp(supplyRatio.times(PRICING.supplyFactorK), 0, PRICING.supplyFactorMax);

  const utilisation = new Decimal(params.currentLoadKw).div(Decimal.max(params.capacityKw, epsilon));
  const congestionFactor = utilisation.lte(PRICING.congestionLowUtilisation)
    ? new Decimal(PRICING.congestionLowFactor)
    : utilisation.lte(PRICING.congestionMediumUtilisation)
      ? new Decimal(PRICING.congestionMediumFactor)
      : new Decimal(PRICING.congestionHighFactor);

  const raw = new Decimal(params.basePrice).times(
    new Decimal(1).plus(demandFactor).minus(supplyFactor).plus(congestionFactor),
  );

  const final = clamp(raw, params.priceFloor, params.priceCeiling);

  return {
    demandFactor: round4(demandFactor),
    supplyFactor: round4(supplyFactor),
    congestionFactor: round4(congestionFactor),
    finalPrice: round4(final),
  };
}

/** Matching engine composite score. §5.5 */
export function computeMatchScore(params: {
  price: Decimal.Value;
  minPrice: Decimal.Value;
  maxPrice: Decimal.Value;
  sameZone: boolean;
  remainingKwh: Decimal.Value;
  requestedKwh: Decimal.Value;
  congestion: "LOW" | "MEDIUM" | "HIGH";
}): Decimal {
  const price = new Decimal(params.price);
  const min = new Decimal(params.minPrice);
  const max = new Decimal(params.maxPrice);
  const spread = Decimal.max(max.minus(min), new Decimal(0.0001));

  const priceScore = new Decimal(1).minus(price.minus(min).div(spread));
  const gridScore = new Decimal(params.sameZone ? 1.0 : 0.6);
  const availScore = Decimal.min(new Decimal(params.remainingKwh).div(Decimal.max(params.requestedKwh, new Decimal(0.0001))), 1);
  const condScore = new Decimal(CONGESTION_SCORE[params.congestion]);

  return round4(
    priceScore
      .times(MATCH_WEIGHTS.price)
      .plus(gridScore.times(MATCH_WEIGHTS.grid))
      .plus(availScore.times(MATCH_WEIGHTS.availability))
      .plus(condScore.times(MATCH_WEIGHTS.congestion)),
  );
}

export function congestionFromUtilisation(availableRatio: number): "LOW" | "MEDIUM" | "HIGH" {
  if (availableRatio > 0.3) return "LOW";
  if (availableRatio > 0.1) return "MEDIUM";
  return "HIGH";
}
