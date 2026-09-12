import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 5000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  corsOrigin: (process.env.CORS_ORIGIN ?? "http://localhost:5173").split(","),

  // Single source of truth for the platform + DISCOM cut. The Sell page reads this
  // back via /users/dashboard rather than hardcoding a percentage — the two drifted
  // apart once already (UI said 5%, server charged 10%).
  platformFeeRate: Number(process.env.PLATFORM_FEE_RATE ?? 0.05),
  creditValidityHours: Number(process.env.CREDIT_VALIDITY_HOURS ?? 72),
  reservationTtlMinutes: Number(process.env.RESERVATION_TTL_MINUTES ?? 5),
  simSpeedMultiplier: Number(process.env.SIM_SPEED_MULTIPLIER ?? 60),
  simTickMs: Number(process.env.SIM_TICK_MS ?? 30000),

  chainMode: (process.env.CHAIN_MODE ?? "simulated") as "live" | "simulated",
  blockchainRpcUrl: process.env.BLOCKCHAIN_RPC_URL ?? "",
  blockchainPrivateKey: process.env.BLOCKCHAIN_PRIVATE_KEY ?? "",
  smartContractAddress: process.env.SMART_CONTRACT_ADDRESS ?? "",

  utilityAdapter: (process.env.UTILITY_ADAPTER ?? "mock") as "mock" | "torrent",
  discomMode: (process.env.DISCOM_MODE ?? "ok") as "ok" | "down" | "partial" | "mismatch",
} as const;
