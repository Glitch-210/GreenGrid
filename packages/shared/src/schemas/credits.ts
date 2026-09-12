import { z } from "zod";
import { CreditStatus } from "../enums";

export const generateCreditSchema = z.object({
  readingId: z.string().uuid(),
});
export type GenerateCreditInput = z.infer<typeof generateCreditSchema>;

export const creditsQuerySchema = z.object({
  status: z.nativeEnum(CreditStatus).optional(),
  /**
   * Sellable == has unlisted quantity left and hasn't expired. Deliberately NOT a
   * status check: `status` tracks lifecycle/chain state and a credit can be LISTED
   * or MINTED while still having balance free to list. See §5.6.
   */
  sellable: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .transform((v) => v === true || v === "true")
    .optional(),
});
