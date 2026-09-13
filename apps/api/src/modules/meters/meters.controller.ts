import type { Request, Response, NextFunction } from "express";
import * as metersService from "./meters.service";
import { ok } from "../../lib/respond";

export async function createMeterHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const meter = await metersService.createMeter(req.user!, req.body);
    ok(res, meter, undefined, 201);
  } catch (err) {
    next(err);
  }
}

export async function listMyMetersHandler(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await metersService.listMyMeters(req.user!));
  } catch (err) {
    next(err);
  }
}

export async function getMeterHandler(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await metersService.getMeterById(req.user!, req.params.id));
  } catch (err) {
    next(err);
  }
}

export async function listReadingsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
    const result = await metersService.listReadings(req.user!, req.params.id, page, pageSize);
    ok(res, result.items, { total: result.total, page: result.page, pageSize: result.pageSize });
  } catch (err) {
    next(err);
  }
}

export async function ingestReadingHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const reading = await metersService.ingestReading(req.user!, req.params.id, req.body);
    ok(res, reading, undefined, 201);
  } catch (err) {
    next(err);
  }
}
