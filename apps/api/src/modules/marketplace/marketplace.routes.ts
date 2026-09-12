import { Router } from "express";
import { Role } from "@wattshare/shared";
import { authMiddleware } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/role.middleware";
import { validate } from "../../middleware/validation.middleware";
import { createListingSchema, listingsQuerySchema } from "./marketplace.validator";
import { createListingHandler, cancelListingHandler, listListingsHandler } from "./marketplace.controller";

export const router = Router();

router.post("/listings", authMiddleware, requireRole(Role.PROSUMER), validate(createListingSchema), createListingHandler);
router.get("/listings", authMiddleware, validate(listingsQuerySchema, "query"), listListingsHandler);
router.delete("/listings/:id", authMiddleware, cancelListingHandler);
