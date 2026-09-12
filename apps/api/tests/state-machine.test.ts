import { assertTransition } from "../src/modules/transactions/state-machine";
import { ApiError } from "../src/lib/ApiError";

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
