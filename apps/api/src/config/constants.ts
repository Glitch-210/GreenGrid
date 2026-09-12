export const API_PREFIX = "/api/v1";

export const DEMO_PASSWORD = "demo1234";

export const CREDIT_ID_PREFIX = "EC";
export const TRANSACTION_ID_PREFIX = "TXN";
export const SETTLEMENT_ID_PREFIX = "SET";

// Reading validation thresholds — §5.1
export const CLOCK_SKEW_MINUTES = 5;
export const GENERATION_RATED_MULTIPLIER = 1.2;
export const GENERATION_MEDIAN_MULTIPLIER = 3;
export const TRAILING_READING_WINDOW = 7;

// Matching engine weights — §5.5
export const MATCH_WEIGHTS = {
  price: 0.4,
  grid: 0.25,
  availability: 0.2,
  congestion: 0.15,
} as const;

export const CONGESTION_SCORE: Record<string, number> = {
  LOW: 1.0,
  MEDIUM: 0.6,
  HIGH: 0.2,
};

// Pricing engine — §5.3
export const PRICING = {
  demandFactorMin: -0.3,
  demandFactorMax: 0.4,
  demandFactorK: 0.35,
  supplyFactorMax: 0.25,
  supplyFactorK: 0.25,
  congestionLowUtilisation: 0.7,
  congestionMediumUtilisation: 0.9,
  congestionLowFactor: 0,
  congestionMediumFactor: 0.1,
  congestionHighFactor: 0.25,
} as const;

// Chain queue — §8
export const CHAIN_RETRY_DELAYS_MS = [2000, 8000, 30000];

/**
 * Transaction statuses in which a seller has actually earned their payout.
 *
 * The threshold is PAID: per the state machine, once a transaction is PAID it can
 * never reach CANCELLED or EXPIRED, so counting from here keeps a seller's reported
 * earnings monotonic — they never see the figure drop as a trade advances.
 *
 * Every status at or past PAID must be listed. Omitting one makes earnings dip and
 * recover while a transaction passes through it (SETTLEMENT_PENDING was missing,
 * which is exactly what happened). Anything before PAID must NOT be listed, or
 * cancelled and failed trades get counted as income.
 */
export const SELLER_EARNED_STATUSES = [
  "PAID",
  "BLOCKCHAIN_PENDING",
  // The chain is an audit trail, not the critical path (README), so a failed anchor
  // does not un-earn a payment the buyer already made. It is terminal, so excluding
  // it would strand the seller's money at zero forever.
  "BLOCKCHAIN_FAILED",
  "CREDIT_TRANSFERRED",
  "SETTLEMENT_PENDING",
  "SETTLEMENT_FAILED",
  "SETTLED",
  "COMPLETED",
] as const;
