import { z } from "zod";

export const demoClockSchema = z.object({
  hour: z.coerce.number().min(0).max(23),
});

export const demoCongestSchema = z.object({
  zoneCode: z.string(),
  congested: z.boolean().default(true),
});

export const demoDiscomSchema = z.object({
  mode: z.enum(["ok", "down", "partial", "mismatch"]),
});
