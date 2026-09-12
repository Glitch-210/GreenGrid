import { Router } from "express";
import { prisma } from "./config/prisma";
import { env } from "./config/env";
import { runtime } from "./config/runtime";
import { chainQueueDepth } from "./adapters/chain/queue";
import { ok } from "./lib/respond";

import { router as authRoutes } from "./modules/auth/auth.routes";
import { router as usersRoutes } from "./modules/users/users.routes";
import { router as metersRoutes } from "./modules/meters/meters.routes";
import { router as creditsRoutes } from "./modules/credits/credits.routes";
import { router as marketplaceRoutes } from "./modules/marketplace/marketplace.routes";
import { router as matchingRoutes } from "./modules/matching/matching.routes";
import { router as transactionsRoutes } from "./modules/transactions/transactions.routes";
import { router as paymentsRoutes } from "./modules/payments/payments.routes";
import { router as settlementRoutes } from "./modules/settlement/settlement.routes";
import { router as gridRoutes } from "./modules/grid/grid.routes";
import { router as pricingRoutes } from "./modules/pricing/pricing.routes";
import { router as analyticsRoutes } from "./modules/analytics/analytics.routes";
import { router as notificationsRoutes } from "./modules/notifications/notifications.routes";
import { router as auditRoutes } from "./modules/audit/audit.routes";
import { router as demoRoutes } from "./modules/demo/demo.routes";

export const router = Router();

router.get("/health", async (_req, res) => {
  let dbOk = true;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbOk = false;
  }

  ok(res, {
    db: dbOk ? "ok" : "down",
    chainMode: env.chainMode,
    discomMode: runtime.discomMode,
    chainQueueDepth: chainQueueDepth(),
  });
});

router.use("/auth", authRoutes);
router.use("/users", usersRoutes);
router.use("/meters", metersRoutes);
router.use("/credits", creditsRoutes);
router.use("/marketplace", marketplaceRoutes);
router.use("/matching", matchingRoutes);
router.use("/transactions", transactionsRoutes);
router.use("/payments", paymentsRoutes);
router.use("/settlements", settlementRoutes);
router.use("/grid", gridRoutes);
router.use("/pricing", pricingRoutes);
router.use("/analytics", analyticsRoutes);
router.use("/notifications", notificationsRoutes);
router.use("/audit", auditRoutes);
router.use("/demo", demoRoutes);
