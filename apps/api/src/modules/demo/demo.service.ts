import { execSync } from "child_process";
import { prisma } from "../../config/prisma";
import { Decimal } from "../../lib/decimal";
import { ApiError } from "../../lib/ApiError";
import { runtime } from "../../config/runtime";
import { jumpToHour } from "../meters/simulated-clock";

/** §6 / §12 — the on-stage demo control panel. */

export async function reset() {
  execSync("npx tsx prisma/seed.ts", { cwd: process.cwd(), stdio: "inherit" });
  return { reset: true };
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
