export interface MeterSnapshot {
  meterId: string;
  generationKwh: string;
  consumptionKwh: string;
  timestamp: string;
}

export interface GridSnapshot {
  zoneId: string;
  loadKw: string;
  capacityKw: string;
  congestion: "LOW" | "MEDIUM" | "HIGH";
}

export interface Tariff {
  zoneId: string;
  ratePerKwh: string;
}

export interface SettlementRules {
  zoneId: string;
  lossFactor: string;
}

export interface SettlementRequest {
  transactionId: string;
  consumerId: string;
  zoneId: string;
  requestedKwh: string;
}

export interface SettlementAck {
  reference: string;
  status: "ACCEPTED" | "REJECTED";
}

export interface SettlementResult {
  reference: string;
  status: "PENDING" | "SETTLED" | "PARTIAL" | "MISMATCH" | "FAILED";
  settledKwh?: string;
}

export interface UtilityAdapter {
  getMeterData(meterId: string): Promise<MeterSnapshot>;
  getGridStatus(zoneId: string): Promise<GridSnapshot>;
  getTariff(zoneId: string): Promise<Tariff>;
  getSettlementRules(zoneId: string): Promise<SettlementRules>;
  submitSettlement(req: SettlementRequest): Promise<SettlementAck>;
  getSettlementStatus(ref: string): Promise<SettlementResult>;
}
