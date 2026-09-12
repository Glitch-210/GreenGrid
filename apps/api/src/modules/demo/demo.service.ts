import { runSeed } from "../../lib/seed-runner";
import { prisma } from "../../config/prisma";
import { Decimal } from "../../lib/decimal";
import { ApiError } from "../../lib/ApiError";
import { logger } from "../../lib/logger";
import { runtime } from "../../config/runtime";
import { jumpToHour } from "../meters/simulated-clock";

/** §6 / §12 — the on-stage demo control panel. */

let resetInProgress = false;
let lastResetAt: Date | null = null;

export async function reset() {
  if (resetInProgress) {
    return { reset: false, status: "already_in_progress" as const };
  }
  resetInProgress = true;
  runSeed(prisma)
    .catch((err) => logger.error("Demo reset seed failed", { err: String(err) }))
    .finally(() => {
      resetInProgress = false;
      lastResetAt = new Date();
    });
  return { reset: true, status: "started" as const };
}

export function getResetStatus() {
  return { inProgress: resetInProgress, lastResetAt: lastResetAt ? lastResetAt.toISOString() : null };
}

export function setClockHour(hour: number) {
  const time = jumpToHour(hour);
  return { simulatedTime: time.toISOString() };
}

export async function congestZone(zoneCode: string, congested: boolean) {
  const zone = await prisma.gridZone.findUnique({ where: { zoneCode } });
  if (!zone) throw ApiError.notFound("Zone not found");

  const targetLoad = congested ? new Decimal(zone.capacityKw).times(0.95) : new Decimal(zone.capacityKw).times(0.6);
  const updated = await prisma.gridZone.update({
    where: { id: zone.id },
    data: { currentLoadKw: targetLoad, status: congested ? "CONGESTED" : "NORMAL" },
  });
  return updated;
}

export function setDiscomMode(mode: "ok" | "down" | "partial" | "mismatch") {
  runtime.discomMode = mode;
  return { discomMode: mode };
}
