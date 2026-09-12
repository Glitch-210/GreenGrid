import { Decimal } from "decimal.js";

Decimal.set({ precision: 30, rounding: Decimal.ROUND_HALF_UP });

export { Decimal };

/** Round a Decimal to 4 dp, the DB's Decimal(18,4) scale. */
export function round4(value: Decimal.Value): Decimal {
  return new Decimal(value).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
}

export function toDecimalString(value: Decimal.Value): string {
  return round4(value).toFixed(4);
}

export function clamp(value: Decimal.Value, min: Decimal.Value, max: Decimal.Value): Decimal {
  const d = new Decimal(value);
  const lo = new Decimal(min);
  const hi = new Decimal(max);
  if (d.lt(lo)) return lo;
  if (d.gt(hi)) return hi;
  return d;
}
