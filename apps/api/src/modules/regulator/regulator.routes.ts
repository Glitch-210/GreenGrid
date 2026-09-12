import { Router } from "express";
import { Role } from "@wattshare/shared";
import { authMiddleware } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/role.middleware";
import { ok } from "../../lib/respond";
import * as regulatorService from "./regulator.service";

export const router = Router();

router.use(authMiddleware, requireRole(Role.REGULATOR, Role.ADMIN));

// Invariant audit check
router.get("/invariants", async (_req, res, next) => {
  try {
    const result = await regulatorService.checkInvariants();
    ok(res, result);
  } catch (err) {
    next(err);
  }
});

// All meters & status update
router.get("/meters", async (_req, res, next) => {
  try {
    const meters = await regulatorService.listAllMeters();
    ok(res, meters);
  } catch (err) {
    next(err);
  }
});

router.post("/meters/:id/status", async (req, res, next) => {
  try {
    const updated = await regulatorService.updateMeterStatus(req.user!, req.params.id, req.body.status, req.body.reason);
    ok(res, updated);
  } catch (err) {
    next(err);
  }
});

// Settlements
router.get("/settlements", async (req, res, next) => {
  try {
    const settlements = await regulatorService.listAllSettlements(req.query.status as string);
    ok(res, settlements);
  } catch (err) {
    next(err);
  }
});

router.post("/settlements/:id/reconcile", async (req, res, next) => {
  try {
    const reconciled = await regulatorService.reconcileSettlement(req.user!, req.params.id, req.body);
    ok(res, reconciled);
  } catch (err) {
    next(err);
  }
});

// Grid Zone Tariff Management
router.post("/zones/:id/tariffs", async (req, res, next) => {
  try {
    const updated = await regulatorService.updateZoneTariffs(req.user!, req.params.id, req.body);
    ok(res, updated);
  } catch (err) {
    next(err);
  }
});

// All transactions
router.get("/transactions", async (_req, res, next) => {
  try {
    const txns = await regulatorService.listAllTransactions();
    ok(res, txns);
  } catch (err) {
    next(err);
  }
});
