import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { currentPriceHandler, priceHistoryHandler } from "./pricing.controller";

export const router = Router();

router.get("/current", authMiddleware, currentPriceHandler);
router.get("/history", authMiddleware, priceHistoryHandler);
