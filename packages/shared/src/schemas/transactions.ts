import { z } from "zod";

export const findMatchesSchema = z.object({
  quantityKwh: z.coerce.number().positive(),
  gridZoneId: z.string().uuid(),
  maxPrice: z.coerce.number().positive().optional(),
});
export type FindMatchesInput = z.infer<typeof findMatchesSchema>;

export const createTransactionSchema = z.object({
  allocations: z
    .array(
      z.object({
        listingId: z.string().uuid(),
        kwh: z.coerce.number().positive(),
      }),
    )
    .min(1),
});
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

export const createPaymentSchema = z.object({
  transactionId: z.string().uuid(),
  simulateFailure: z.boolean().optional(),
});
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
