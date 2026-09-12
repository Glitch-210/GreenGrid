import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { marketAnalyticsHandler, myAnalyticsHandler } from "./analytics.controller";

export const router = Router();

router.get("/market", authMiddleware, marketAnalyticsHandler);
router.get("/me", authMiddleware, myAnalyticsHandler);
