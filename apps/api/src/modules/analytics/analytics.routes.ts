import { Router } from "express";
import { Role } from "@wattshare/shared";
import { authMiddleware } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/role.middleware";
import { marketAnalyticsHandler, myAnalyticsHandler } from "./analytics.controller";

export const router = Router();

// Platform-wide volume, value and flagged-reading counts are oversight data, not
// something every signed-in trader should see.
router.get("/market", authMiddleware, requireRole(Role.UTILITY, Role.REGULATOR, Role.ADMIN), marketAnalyticsHandler);
router.get("/me", authMiddleware, myAnalyticsHandler);
