import { runtime } from "../../config/runtime";
import { nextSettlementRef } from "../../lib/ids";
import type {
  GridSnapshot,
  MeterSnapshot,
  SettlementAck,
  SettlementRequest,
  SettlementResult,
  SettlementRules,
  Tariff,
  UtilityAdapter,
} from "./UtilityAdapter";

interface PendingSettlement {
  requestedKwh: string;
  submittedAt: number;
}

const pending = new Map<string, PendingSettlement>();
const SETTLE_DELAY_MS = 2_000; // becomes resolvable after this much real time

export class MockUtilityAdapter implements UtilityAdapter {
  async getMeterData(meterId: string): Promise<MeterSnapshot> {
    return { meterId, generationKwh: "0", consumptionKwh: "0", timestamp: new Date().toISOString() };
  }

  async getGridStatus(zoneId: string): Promise<GridSnapshot> {
    return { zoneId, loadKw: "0", capacityKw: "0", congestion: "LOW" };
  }

  async getTariff(zoneId: string): Promise<Tariff> {
    return { zoneId, ratePerKwh: "5.0000" };
  }

  async getSettlementRules(zoneId: string): Promise<SettlementRules> {
    return { zoneId, lossFactor: "0.87" };
  }

  async submitSettlement(req: SettlementRequest): Promise<SettlementAck> {
    await delay(800);
    if (runtime.discomMode === "down") {
      const err: any = new Error("DISCOM unavailable");
      err.statusCode = 503;
      throw err;
    }
    const reference = nextSettlementRef();
    pending.set(reference, { requestedKwh: req.requestedKwh, submittedAt: Date.now() });
    return { reference, status: "ACCEPTED" };
  }

  async getSettlementStatus(ref: string): Promise<SettlementResult> {
    if (runtime.discomMode === "down") {
      return { reference: ref, status: "PENDING" };
    }
    const record = pending.get(ref);
    if (!record) return { reference: ref, status: "FAILED" };
    if (Date.now() - record.submittedAt < SETTLE_DELAY_MS) {
      return { reference: ref, status: "PENDING" };
    }

    const requested = Number(record.requestedKwh);
    if (runtime.discomMode === "partial") {
      return { reference: ref, status: "PARTIAL", settledKwh: (requested * 0.8).toFixed(4) };
    }
    if (runtime.discomMode === "mismatch") {
      return { reference: ref, status: "MISMATCH", settledKwh: Math.min(95, requested).toFixed(4) };
    }
    return { reference: ref, status: "SETTLED", settledKwh: requested.toFixed(4) };
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
