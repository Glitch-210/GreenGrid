import type { TxStatus } from "@prisma/client";
import { ApiError } from "../../lib/ApiError";

/** IMPLEMENTATION_PLAN.md §5.6 — the only place transitions are decided. */
const TRANSITIONS: Record<TxStatus, TxStatus[]> = {
  PENDING: ["MATCHED", "CANCELLED", "EXPIRED"],
  MATCHED: ["RESERVED", "CANCELLED", "EXPIRED"],
  RESERVED: ["PAYMENT_PENDING", "CANCELLED", "EXPIRED"],
  PAYMENT_PENDING: ["PAID", "PAYMENT_FAILED", "CANCELLED", "EXPIRED"],
  PAID: ["BLOCKCHAIN_PENDING", "CREDIT_TRANSFERRED"],
  BLOCKCHAIN_PENDING: ["CREDIT_TRANSFERRED", "BLOCKCHAIN_FAILED"],
  CREDIT_TRANSFERRED: ["SETTLEMENT_PENDING"],
  SETTLEMENT_PENDING: ["SETTLED", "SETTLEMENT_FAILED"],
  SETTLEMENT_FAILED: ["SETTLEMENT_PENDING", "SETTLED"],
  SETTLED: ["COMPLETED"],
  COMPLETED: [],
  PAYMENT_FAILED: [],
  BLOCKCHAIN_FAILED: [],
  CANCELLED: [],
  EXPIRED: [],
};

export function assertTransition(from: TxStatus, to: TxStatus) {
  const allowed = TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw ApiError.conflict("VALIDATION_ERROR", `Illegal transaction transition: ${from} -> ${to}`);
  }
}
