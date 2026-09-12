import { assertTransition, TRANSITIONS } from "../src/modules/transactions/state-machine";
import { ApiError } from "../src/lib/ApiError";
import { SELLER_EARNED_STATUSES } from "../src/config/constants";
import type { TxStatus } from "@prisma/client";

describe("transaction state machine", () => {
  it("allows the documented happy path", () => {
    expect(() => assertTransition("PENDING", "MATCHED")).not.toThrow();
    expect(() => assertTransition("MATCHED", "RESERVED")).not.toThrow();
    expect(() => assertTransition("RESERVED", "PAYMENT_PENDING")).not.toThrow();
    expect(() => assertTransition("PAYMENT_PENDING", "PAID")).not.toThrow();
    expect(() => assertTransition("PAID", "CREDIT_TRANSFERRED")).not.toThrow();
    expect(() => assertTransition("CREDIT_TRANSFERRED", "SETTLEMENT_PENDING")).not.toThrow();
    expect(() => assertTransition("SETTLEMENT_PENDING", "SETTLED")).not.toThrow();
    expect(() => assertTransition("SETTLED", "COMPLETED")).not.toThrow();
  });

  it("rejects illegal jumps", () => {
    expect(() => assertTransition("PENDING", "COMPLETED")).toThrow(ApiError);
    expect(() => assertTransition("COMPLETED", "PENDING")).toThrow(ApiError);
    expect(() => assertTransition("CANCELLED", "RESERVED")).toThrow(ApiError);
  });

  it("allows failure/cancellation paths from RESERVED and PAYMENT_PENDING", () => {
    expect(() => assertTransition("RESERVED", "CANCELLED")).not.toThrow();
    expect(() => assertTransition("RESERVED", "EXPIRED")).not.toThrow();
    expect(() => assertTransition("PAYMENT_PENDING", "PAYMENT_FAILED")).not.toThrow();
  });
});

/**
 * Bug 26: a prosumer's earnings dipped and recovered mid-lifecycle because
 * SETTLEMENT_PENDING was missing from the earned-status list. Rather than
 * hand-checking the list again, walk the state machine: everything reachable from
 * PAID must be counted, and nothing reachable from PAID may be a cancel/expire.
 */
describe("SELLER_EARNED_STATUSES covers the whole post-payment lifecycle", () => {
  function reachableFrom(start: TxStatus): Set<TxStatus> {
    const seen = new Set<TxStatus>();
    const queue: TxStatus[] = [start];
    while (queue.length) {
      const s = queue.shift()!;
      if (seen.has(s)) continue;
      seen.add(s);
      for (const next of TRANSITIONS[s]) queue.push(next);
    }
    return seen;
  }

  it("counts every status reachable once a transaction is PAID", () => {
    const earned = new Set<string>(SELLER_EARNED_STATUSES);
    const missing = [...reachableFrom("PAID")].filter((s) => !earned.has(s));
    expect(missing).toEqual([]);
  });

  it("counts nothing that can still be cancelled or expired", () => {
    for (const status of SELLER_EARNED_STATUSES) {
      const onwards = reachableFrom(status as TxStatus);
      expect([...onwards]).not.toContain("CANCELLED");
      expect([...onwards]).not.toContain("EXPIRED");
    }
  });
});
