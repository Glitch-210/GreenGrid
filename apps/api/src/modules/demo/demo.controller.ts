import type { Request, Response, NextFunction } from "express";
import * as demoService from "./demo.service";
import { ok } from "../../lib/respond";

export async function resetHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await demoService.reset());
  } catch (err) {
    next(err);
  }
}

export function resetStatusHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, demoService.getResetStatus());
  } catch (err) {
    next(err);
  }
}

export function clockHandler(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, demoService.setClockHour(req.body.hour));
  } catch (err) {
    next(err);
  }
}

export async function congestHandler(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await demoService.congestZone(req.body.zoneCode, req.body.congested));
  } catch (err) {
    next(err);
  }
}

export function discomHandler(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, demoService.setDiscomMode(req.body.mode));
  } catch (err) {
    next(err);
  }
}
