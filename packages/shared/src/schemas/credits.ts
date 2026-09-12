import { z } from "zod";
import { CreditStatus } from "../enums";

export const generateCreditSchema = z.object({
  readingId: z.string().uuid(),
});
export type GenerateCreditInput = z.infer<typeof generateCreditSchema>;

export const creditsQuerySchema = z.object({
  status: z.nativeEnum(CreditStatus).optional(),
});
