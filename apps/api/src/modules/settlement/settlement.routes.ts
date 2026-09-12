import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { getSettlementHandler } from "./settlement.controller";

export const router = Router();

router.get("/:id", authMiddleware, getSettlementHandler);
