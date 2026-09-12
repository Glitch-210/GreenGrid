import { eligibleCreditKwh, computeFinalPrice, computeMatchScore, bellCurve } from "../src/lib/calculations";
import { Decimal } from "../src/lib/decimal";

describe("eligibleCreditKwh", () => {
  it("applies the loss factor to gross surplus", () => {
    const result = eligibleCreditKwh(150, 20, 0.87);
    expect(result.toFixed(4)).toBe(new Decimal(130).times(0.87).toFixed(4));
  });

  it("floors negative surplus at zero", () => {
    const result = eligibleCreditKwh(10, 50, 0.87);
    expect(result.toFixed(4)).toBe("0.0000");
  });
});

describe("computeFinalPrice", () => {
  const base = {
    basePrice: 4,
    priceFloor: 2.5,
    priceCeiling: 7,
    currentLoadKw: 620,
    capacityKw: 1000,
  };

  it("clamps to the floor when demand is far below supply", () => {
    const { finalPrice } = computeFinalPrice({ ...base, supplyKwh: 10000, demandKwh: 1 });
    expect(finalPrice.gte(2.5)).toBe(true);
  });

  it("clamps to the ceiling when demand vastly exceeds supply", () => {
    // max possible multiplier is (1 + demandFactorMax - 0 + congestionHighFactor) = 1.65x;
    // use a base high enough that 1.65x actually exceeds the ceiling.
    const { finalPrice } = computeFinalPrice({ ...base, basePrice: 5, supplyKwh: 1, demandKwh: 100000, currentLoadKw: 950, capacityKw: 1000 });
    expect(finalPrice.toFixed(4)).toBe("7.0000");
  });

  it("never exceeds the configured band for any inputs", () => {
    for (const demand of [0.001, 10, 1000, 1_000_000]) {
      for (const supply of [0.001, 10, 1000, 1_000_000]) {
        const { finalPrice } = computeFinalPrice({ ...base, supplyKwh: supply, demandKwh: demand });
        expect(finalPrice.gte(2.5)).toBe(true);
        expect(finalPrice.lte(7)).toBe(true);
      }
    }
  });
});

describe("computeMatchScore", () => {
  it("scores a cheaper, same-zone, fully-available, low-congestion listing higher", () => {
    const cheapGood = computeMatchScore({
      price: 4,
      minPrice: 4,
      maxPrice: 5,
      sameZone: true,
      remainingKwh: 500,
      requestedKwh: 100,
      congestion: "LOW",
    });
    const expensiveBad = computeMatchScore({
      price: 5,
      minPrice: 4,
      maxPrice: 5,
      sameZone: false,
      remainingKwh: 10,
      requestedKwh: 100,
      congestion: "HIGH",
    });
    expect(cheapGood.gt(expensiveBad)).toBe(true);
  });
});

describe("bellCurve", () => {
  it("peaks at the configured hour", () => {
    expect(bellCurve(13, 13)).toBeCloseTo(1, 5);
  });

  it("is near zero far from the peak", () => {
    expect(bellCurve(1, 13, 3.2)).toBeLessThan(0.01);
  });
});
