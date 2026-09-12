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
});
export type ListingsQuery = z.infer<typeof listingsQuerySchema>;
