import { env } from "./env";

/** Mutable runtime overrides toggled by the demo control panel (§6, §12). */
export const runtime = {
  discomMode: env.discomMode as "ok" | "down" | "partial" | "mismatch",
};
