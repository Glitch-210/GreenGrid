import { z } from "zod";
import { MeterType } from "../enums";

export const createMeterSchema = z.object({
  meterNumber: z.string().min(3).max(50),
  gridZoneId: z.string().uuid(),
  meterType: z.nativeEnum(MeterType),
  ratedKw: z.coerce.number().positive().optional(),
});
export type CreateMeterInput = z.infer<typeof createMeterSchema>;

export const ingestReadingSchema = z.object({
  externalId: z.string().min(1),
  timestamp: z.coerce.date(),
  generationKwh: z.coerce.number().min(0),
  consumptionKwh: z.coerce.number().min(0),
});
export type IngestReadingInput = z.infer<typeof ingestReadingSchema>;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});
