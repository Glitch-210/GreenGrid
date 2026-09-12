import { env } from "../../config/env";

// Simulated clock runs SIM_SPEED_MULTIPLIER x real time; one tick (SIM_TICK_MS of real time)
// advances the simulated clock by 15 simulated minutes.
let simulatedMs = Date.now();

export function advanceSimulatedClock() {
  simulatedMs += 15 * 60 * 1000;
  return new Date(simulatedMs);
}

export function getSimulatedTime(): Date {
  return new Date(simulatedMs);
}

export function getSimulatedHour(): number {
  return getSimulatedTime().getUTCHours();
}

/** Demo control: jump the simulated clock to a given hour (today, UTC). */
export function jumpToHour(hour: number) {
  const d = getSimulatedTime();
  d.setUTCHours(hour, 0, 0, 0);
  simulatedMs = d.getTime();
  return d;
}

void env.simSpeedMultiplier; // documented multiplier, real pacing is driven by SIM_TICK_MS
