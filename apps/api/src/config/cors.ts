import { env } from "./env";

export function isOriginAllowed(origin?: string): boolean {
  if (!origin) return true;
  if (env.corsOrigin.includes("*") || env.corsOrigin.includes(origin)) return true;
  try {
    const hostname = new URL(origin).hostname;
    if (
      hostname.endsWith(".vercel.app") ||
      hostname === "localhost" ||
      hostname === "127.0.0.1"
    ) {
      return true;
    }
  } catch {
    // Ignore URL parse failure
  }
  return false;
}
