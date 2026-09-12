import cron from "node-cron";
import { env } from "../config/env";
import { logger } from "../lib/logger";
import { runSimulatorTick } from "../modules/meters/simulator";
import { runPricingTick } from "../modules/pricing/pricing-engine.service";
import { pollSettlements } from "../modules/settlement/settlement.service";
import { processChainQueue } from "../adapters/chain/queue";

let started = false;

export function startScheduler() {
  if (started) return;
  started = true;

  // 1 simulated 15-min interval every SIM_TICK_MS of real time (default 30s = 60x speed)
  setInterval(() => {
    runSimulatorTick().catch((err) => logger.error("simulator tick failed", { err: String(err) }));
  }, env.simTickMs);

  // pricing recompute every 20s per zone
  setInterval(() => {
    runPricingTick().catch((err) => logger.error("pricing tick failed", { err: String(err) }));
  }, 20_000);

  // settlement poll every 10s
  cron.schedule("*/10 * * * * *", () => {
    pollSettlements().catch((err) => logger.error("settlement poll failed", { err: String(err) }));
  });

  // chain queue drain every 3s
  setInterval(() => {
    processChainQueue().catch((err) => logger.error("chain queue failed", { err: String(err) }));
  }, 3_000);

  logger.info("Scheduler started", { simTickMs: env.simTickMs });
}
