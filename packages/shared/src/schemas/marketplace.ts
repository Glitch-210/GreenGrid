import { z } from "zod";

export const createListingSchema = z.object({
  creditId: z.string().uuid(),
  quantityKwh: z.coerce.number().positive(),
  pricePerKwh: z.coerce.number().positive(),
});
export type CreateListingInput = z.infer<typeof createListingSchema>;

export const listingsQuerySchema = z.object({
  zone: z.string().optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().positive().optional(),
  minQty: z.coerce.number().nonnegative().optional(),
  sort: z.enum(["price_asc", "price_desc", "newest"]).default("price_asc"),
  /**
   * Restrict to the caller's own listings, and widen the status filter past
   * ACTIVE/PARTIAL so a seller can see their SOLD and CANCELLED history — which
   * is otherwise unreachable through any endpoint.
   */
  mine: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .transform((v) => v === true || v === "true")
    .optional(),
});
export type ListingsQuery = z.infer<typeof listingsQuerySchema>;
