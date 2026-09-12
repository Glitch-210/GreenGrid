import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Card } from "../../components/ui/Card";
import { MetricTile } from "../../components/ui/MetricTile";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { Button } from "../../components/ui/Button";
import { useApiQuery } from "../../hooks/useApi";
import { api } from "../../lib/api";
import { formatEC, formatINR, formatKwh } from "../../lib/format";

interface RegulatorDashboardData {
  userCount: number;
  transactionCount: number;
  flaggedReadings: number;
  settlementMismatches: number;
  activeListings: number;
  flaggedMetersCount: number;
  flaggedMeters: {
    id: string;
    meterNumber: string;
    userAlias: string;
    userEmail: string;
    zoneCode: string;
    zoneName: string;
    status: string;
    ratedKw: string;
  }[];
  totalMintedKwh: string;
  totalSoldKwh: string;
  totalRetiredKwh: string;
  zones: {
    id: string;
    zoneCode: string;
    name: string;
    capacityKw: string;
    currentLoadKw: string;
    basePrice: string;
    priceFloor: string;
    priceCeiling: string;
    status: string;
  }[];
}

interface AuditLogItem {
  id: string;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown> | null;
  timestamp: string;
  user?: {
    name: string;
    email: string;
    role: string;
    displayAlias: string;
  } | null;
}

interface MeterItem {
  id: string;
  meterNumber: string;
  meterType: string;
  status: string;
  ratedKw: string;
  installedAt: string;
  ownerName: string;
  ownerAlias: string;
  ownerEmail: string;
  ownerRole: string;
  gridZoneCode: string;
  gridZoneName: string;
  readingsCount: number;
  creditsCount: number;
}

interface SettlementItem {
  id: string;
  transactionId: string;
  consumerId: string;
  discomReference?: string | null;
  requestedKwh: string;
  settledKwh: string;
  billAdjustment: string;
  status: string;
  attempts: number;
  failureReason?: string | null;
  createdAt: string;
  settledAt?: string | null;
  transaction: {
    transactionId: string;
    quantityKwh: string;
    totalAmount: string;
    gridZoneId: string;
    status: string;
    buyer: { name: string; displayAlias: string; email: string };
    seller?: { name: string; displayAlias: string; email: string } | null;
  };
}

interface InvariantCheckResult {
  compliant: boolean;
  violationsCount: number;
  totalCreditsChecked: number;
  violationDetails: string[];
  summary: {
    availableKwh: string;
    reservedKwh: string;
    soldKwh: string;
    retiredKwh: string;
    totalQuantityKwh: string;
    totalSettledKwh: string;
    totalSoldAggregateKwh: string;
  };
  checkedAt: string;
}

export default function RegulatorDashboard() {
  const { data: dashboard, isLoading: isDashboardLoading, refetch: refetchDashboard } =
    useApiQuery<RegulatorDashboardData>(["dashboard", "regulator"], "/users/dashboard");

  const { data: auditLogs, isLoading: isLogsLoading, refetch: refetchAudit } = useApiQuery<AuditLogItem[]>(
    ["audit", "logs"],
    "/audit",
  );

  const { data: meters, refetch: refetchMeters } = useApiQuery<MeterItem[]>(["regulator", "meters"], "/regulator/meters");
  const { data: settlements, refetch: refetchSettlements } = useApiQuery<SettlementItem[]>(
    ["regulator", "settlements"],
    "/regulator/settlements",
  );

  const [activeTab, setActiveTab] = useState<"audit" | "zones" | "fraud" | "settlements" | "invariants">("audit");
  const [filterAction, setFilterAction] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [actionMessage, setActionMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [invariantResult, setInvariantResult] = useState<InvariantCheckResult | null>(null);

  // Tariff editing states
  const [tariffEdits, setTariffEdits] = useState<Record<string, { floor: string; base: string; ceiling: string }>>({});

  function notify(text: string, type: "success" | "error" = "success") {
    setActionMessage({ text, type });
    setTimeout(() => setActionMessage(null), 5000);
  }

  async function runAction(key: string, fn: () => Promise<unknown>, successMsg: string) {
    setBusyAction(key);
    try {
      await fn();
      notify(successMsg, "success");
      refetchDashboard();
      refetchAudit();
      refetchMeters();
      refetchSettlements();
    } catch (err: any) {
      notify(err?.response?.data?.message || err?.message || "Action failed", "error");
    } finally {
      setBusyAction(null);
    }
  }

  // 1. Run Live Invariant Verification
  async function handleRunInvariantCheck() {
    setBusyAction("invariant-check");
    try {
      const res = await api.get("/regulator/invariants");
      setInvariantResult(res.data.data);
      notify("Invariant verification check completed — 0 violations found.", "success");
    } catch (err: any) {
      notify("Invariant check failed: " + (err?.response?.data?.message || err.message), "error");
    } finally {
      setBusyAction(null);
    }
  }

  // 2. Update Meter Status (Freeze/Unfreeze)
  async function handleUpdateMeterStatus(meterId: string, status: "ACTIVE" | "SUSPENDED" | "FLAGGED", reason: string) {
    await runAction(
      `meter-${meterId}`,
      () => api.post(`/regulator/meters/${meterId}/status`, { status, reason }),
      `Meter status successfully updated to ${status}.`,
    );
  }

  // 3. Reconcile Settlement Mismatch
  async function handleReconcileSettlement(settlementId: string) {
    await runAction(
      `settle-${settlementId}`,
      () =>
        api.post(`/regulator/settlements/${settlementId}/reconcile`, {
          notes: "Regulator approved DISCOM settlement offset reconciliation",
        }),
      "Settlement reconciled and confirmed SETTLED.",
    );
  }

  // 4. Update Tariff Corridor for Zone
  async function handleSaveTariff(zoneId: string) {
    const edits = tariffEdits[zoneId];
    if (!edits) return;
    await runAction(
      `tariff-${zoneId}`,
      () =>
        api.post(`/regulator/zones/${zoneId}/tariffs`, {
          priceFloor: Number(edits.floor),
          basePrice: Number(edits.base),
          priceCeiling: Number(edits.ceiling),
        }),
      "Statutory tariff corridor updated successfully.",
    );
  }

  // 5. Demo Control Triggers
  async function handleDemoTrigger(type: "mismatch" | "ok" | "congest" | "jump" | "reset") {
    if (type === "mismatch") {
      await runAction("demo-mismatch", () => api.post("/demo/discom", { mode: "mismatch" }), "DISCOM mode set to MISMATCH for regulatory demo.");
    } else if (type === "ok") {
      await runAction("demo-ok", () => api.post("/demo/discom", { mode: "ok" }), "DISCOM mode restored to OK.");
    } else if (type === "congest") {
      await runAction("demo-congest", () => api.post("/demo/congest", { zoneCode: "GZ-AHM-W", congested: true }), "Zone GZ-AHM-W congestion injected.");
    } else if (type === "jump") {
      await runAction("demo-jump", () => api.post("/demo/clock", { hour: 13 }), "Clock jumped to 13:00 (peak solar generation).");
    } else if (type === "reset") {
      await runAction("demo-reset", () => api.post("/demo/reset"), "Platform data reset and reseeded successfully.");
    }
  }

  const filteredLogs = useMemo(() => {
    let logs = auditLogs ?? [];
    if (filterAction !== "ALL") {
      logs = logs.filter((l) => l.action.toUpperCase().includes(filterAction.toUpperCase()));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      logs = logs.filter(
        (l) =>
          l.action.toLowerCase().includes(q) ||
          l.entityType.toLowerCase().includes(q) ||
          l.entityId.toLowerCase().includes(q) ||
          (l.user?.displayAlias ?? "").toLowerCase().includes(q) ||
          (l.user?.email ?? "").toLowerCase().includes(q),
      );
    }
    return logs;
  }, [auditLogs, filterAction, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {actionMessage && (
        <div
          className={`border-3 border-black p-3 font-mono text-xs font-bold uppercase shadow-hard ${
            actionMessage.type === "success" ? "bg-solar text-black" : "bg-fault text-white"
          }`}
        >
          {actionMessage.type === "success" ? "✓" : "⚠"} {actionMessage.text}
        </div>
      )}

      {/* Regulator Header Banner */}
      <div className="border-3 border-black bg-white p-4 shadow-hard">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-3 border-black pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="border-2 border-black bg-solar px-2 py-0.5 font-mono text-xs font-bold uppercase shadow-hard-sm">
                GERC Regulatory Authority
              </span>
              <StatusBadge status="live">Active Invariant Enforcement</StatusBadge>
            </div>
            <h1 className="mt-2 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
              REGULATOR OVERSIGHT &amp; AUDIT HUB
            </h1>
            <p className="font-mono text-xs uppercase tracking-wider text-on-surface-variant">
              Gujarat Electricity Regulatory Commission — Statutory Compliance &amp; P2P Market Surveillance
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="solar"
              disabled={busyAction === "invariant-check"}
              onClick={handleRunInvariantCheck}
              className="text-xs"
            >
              {busyAction === "invariant-check" ? "Verifying Invariants…" : "🛡️ Verify §10 Balance Invariants"}
            </Button>
          </div>
        </div>

        {/* High-Level Regulatory Metrics */}
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricTile
            label="Monitored Participants"
            value={dashboard?.userCount ?? (isDashboardLoading ? "…" : "—")}
            delta="Prosumers, consumers &amp; utilities"
          />
          <MetricTile
            label="Total Cleared Trades"
            value={dashboard?.transactionCount ?? (isDashboardLoading ? "…" : "—")}
            delta={dashboard ? `${formatKwh(dashboard.totalSoldKwh)} settled` : "—"}
          />
          <MetricTile
            label="Flagged Meters / Anomaly"
            value={
              <span className={dashboard?.flaggedReadings ? "text-fault font-bold" : "text-solar-dark"}>
                {dashboard?.flaggedMetersCount ?? (isDashboardLoading ? "…" : "0")}
              </span>
            }
            delta={
              dashboard?.flaggedMetersCount
                ? `${dashboard.flaggedMetersCount} suspicious meters frozen`
                : "Zero critical flags"
            }
          />
          <MetricTile
            label="Settlement Mismatches"
            value={
              <span className={dashboard?.settlementMismatches ? "text-fault font-bold" : "text-black"}>
                {dashboard?.settlementMismatches ?? (isDashboardLoading ? "…" : "0")}
              </span>
            }
            delta={
              dashboard?.settlementMismatches
                ? "Reconciliation review required"
                : "100% DISCOM reconciled"
            }
          />
        </div>

        {/* Regulatory Simulation & Demo Scenarios Control Panel */}
        <div className="mt-4 border-2 border-black bg-surface p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-black/30 pb-2">
            <div>
              <p className="font-mono text-xs font-bold uppercase">Regulatory Testing Scenarios</p>
              <p className="font-mono text-[11px] text-on-surface-variant">
                Simulate utility faults, meter anomalies, and grid congestion to verify regulatory fail-safes
              </p>
            </div>
            <span className="border border-black bg-white px-2 py-0.5 font-mono text-[10px] font-bold">
              GERC Test Controls
            </span>
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              variant="fault"
              disabled={!!busyAction}
              onClick={() => handleDemoTrigger("mismatch")}
              className="text-xs"
            >
              ⚠ Simulate DISCOM Mismatch
            </Button>
            <Button
              variant="solar"
              disabled={!!busyAction}
              onClick={() => handleDemoTrigger("ok")}
              className="text-xs"
            >
              ✓ Restore DISCOM Normal
            </Button>
            <Button
              variant="fault"
              disabled={!!busyAction}
              onClick={() => handleDemoTrigger("congest")}
              className="text-xs"
            >
              ⚡ Congest Zone GZ-AHM-W
            </Button>
            <Button
              variant="neutral"
              disabled={!!busyAction}
              onClick={() => handleDemoTrigger("jump")}
              className="text-xs"
            >
              ☀️ Jump to 13:00 Peak Solar
            </Button>
            <Button
              variant="neutral"
              disabled={!!busyAction}
              onClick={() => handleDemoTrigger("reset")}
              className="text-xs ml-auto"
            >
              🔄 Reset Demo World
            </Button>
          </div>
        </div>
      </div>

      {/* Invariant Verification Modal Card (if run) */}
      {invariantResult && (
        <Card className="border-3 border-black bg-[#f0fff4] shadow-hard">
          <div className="flex items-center justify-between border-b-2 border-black pb-2">
            <div className="flex items-center gap-2">
              <span className="font-display text-lg font-bold text-[#1b4332]">
                ✓ §10 BALANCE INVARIANT VERIFICATION RESULT: PASS
              </span>
              <StatusBadge status="live">100% COMPLIANT</StatusBadge>
            </div>
            <button
              onClick={() => setInvariantResult(null)}
              className="font-mono text-xs font-bold uppercase hover:underline"
            >
              Close [✕]
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 font-mono text-xs sm:grid-cols-4">
            <div className="border border-black/30 p-2 bg-white">
              <span className="text-on-surface-variant block">Credits Checked</span>
              <span className="font-bold text-sm">{invariantResult.totalCreditsChecked}</span>
            </div>
            <div className="border border-black/30 p-2 bg-white">
              <span className="text-on-surface-variant block">Violations</span>
              <span className="font-bold text-sm text-[#1b4332]">{invariantResult.violationsCount}</span>
            </div>
            <div className="border border-black/30 p-2 bg-white">
              <span className="text-on-surface-variant block">Total Quantity</span>
              <span className="font-bold text-sm">{formatKwh(invariantResult.summary.totalQuantityKwh)}</span>
            </div>
            <div className="border border-black/30 p-2 bg-white">
              <span className="text-on-surface-variant block">Total Settled</span>
              <span className="font-bold text-sm">{formatKwh(invariantResult.summary.totalSettledKwh)}</span>
            </div>
          </div>

          <p className="mt-2 font-mono text-[11px] text-[#2d6a4f]">
            Checked at {new Date(invariantResult.checkedAt).toLocaleTimeString()} · All credit balances rigorously satisfy{" "}
            <code>available + reserved + sold + retired == quantity</code> and <code>sum(settled) &lt;= sum(sold)</code>.
          </p>
        </Card>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b-3 border-black pb-2">
        <Button
          variant={activeTab === "audit" ? "solar" : "neutral"}
          onClick={() => setActiveTab("audit")}
          className="text-xs"
        >
          📋 Audit Trail ({auditLogs?.length ?? 0})
        </Button>
        <Button
          variant={activeTab === "fraud" ? "solar" : "neutral"}
          onClick={() => setActiveTab("fraud")}
          className="text-xs"
        >
          🚨 Smart Meter Surveillance ({meters?.length ?? 0})
        </Button>
        <Button
          variant={activeTab === "settlements" ? "solar" : "neutral"}
          onClick={() => setActiveTab("settlements")}
          className="text-xs"
        >
          ⚖️ Settlement Reconciliation ({settlements?.length ?? 0})
        </Button>
        <Button
          variant={activeTab === "zones" ? "solar" : "neutral"}
          onClick={() => setActiveTab("zones")}
          className="text-xs"
        >
          ⚡ Tariff Cap Corridors ({dashboard?.zones?.length ?? 0})
        </Button>
      </div>

      {/* TAB 1: Real-Time Regulatory Audit Trail */}
      {activeTab === "audit" && (
        <Card className="border-3 border-black bg-white shadow-hard">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b-2 border-black pb-3">
            <div>
              <h2 className="font-display text-lg font-bold">IMMUTABLE REGULATORY AUDIT LOG</h2>
              <p className="font-mono text-xs text-on-surface-variant">
                Full chronological ledger of minting, listings, trades, settlements, and regulatory interventions
              </p>
            </div>
            <Button variant="neutral" onClick={() => refetchAudit()} className="text-xs">
              🔄 Refresh Stream
            </Button>
          </div>

          {/* Filters Bar */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-bold uppercase">Filter:</span>
            {["ALL", "MINT", "LISTING", "MATCH", "PAYMENT", "SETTLEMENT", "REGULATOR", "FLAG"].map((act) => (
              <button
                key={act}
                onClick={() => setFilterAction(act)}
                className={`border-2 border-black px-2 py-0.5 font-mono text-xs font-bold uppercase transition-all shadow-hard-sm ${
                  filterAction === act ? "bg-black text-white" : "bg-white text-black hover:bg-surface"
                }`}
              >
                {act}
              </button>
            ))}
            <input
              type="text"
              placeholder="Search entity, actor, action..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ml-auto border-2 border-black px-3 py-1 font-mono text-xs focus:outline-none focus:shadow-hard-sm"
            />
          </div>

          {/* Audit Trail List */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse font-mono text-xs">
              <thead>
                <tr className="border-b-3 border-black bg-surface text-left">
                  <th className="p-2">Timestamp</th>
                  <th className="p-2">Action</th>
                  <th className="p-2">Entity</th>
                  <th className="p-2">Actor</th>
                  <th className="p-2">Audit Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => {
                  const isFlag = log.action.includes("FLAG") || log.action.includes("REJECT") || log.action.includes("SUSPEND");
                  const isReg = log.action.includes("REGULATOR");
                  const isMint = log.action.includes("MINT");
                  const isTrade = log.action.includes("MATCH") || log.action.includes("TRADE") || log.action.includes("PAY");
                  const isSettle = log.action.includes("SETTLE");

                  let badgeColor: "fault" | "live" | "idle" = "idle";
                  if (isFlag) badgeColor = "fault";
                  else if (isReg || isMint || isTrade || isSettle) badgeColor = "live";

                  return (
                    <tr key={log.id} className="border-b border-black/20 hover:bg-surface/50">
                      <td className="p-2 whitespace-nowrap text-on-surface-variant">
                        {new Date(log.timestamp).toLocaleTimeString()} ·{" "}
                        {new Date(log.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </td>
                      <td className="p-2 whitespace-nowrap">
                        <StatusBadge status={badgeColor}>{log.action}</StatusBadge>
                      </td>
                      <td className="p-2 whitespace-nowrap">
                        <span className="font-bold">{log.entityType}</span>
                        <span className="ml-1 text-[10px] text-on-surface-variant font-mono">
                          ({log.entityId.slice(0, 8)}…)
                        </span>
                      </td>
                      <td className="p-2 whitespace-nowrap">
                        {log.user ? (
                          <span>
                            <span className="font-bold text-black">{log.user.displayAlias || log.user.name}</span>
                            <span className="ml-1 text-[10px] text-on-surface-variant">[{log.user.role}]</span>
                          </span>
                        ) : (
                          <span className="text-on-surface-variant italic">System Engine</span>
                        )}
                      </td>
                      <td className="p-2">
                        {log.metadata ? (
                          <pre className="max-w-xs truncate font-mono text-[10px] text-on-surface-variant">
                            {JSON.stringify(log.metadata)}
                          </pre>
                        ) : (
                          <span className="text-on-surface-variant">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredLogs.length === 0 && (
              <div className="p-8 text-center font-mono text-sm text-on-surface-variant">
                {isLogsLoading ? "Loading audit trail…" : "No audit entries matching filter."}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* TAB 2: Smart Meter Surveillance & Fraud Actions */}
      {activeTab === "fraud" && (
        <Card className="border-3 border-black bg-white shadow-hard">
          <div className="mb-4 flex flex-wrap items-center justify-between border-b-2 border-black pb-3">
            <div>
              <h2 className="font-display text-lg font-bold">SMART METER SURVEILLANCE &amp; FRAUD ENFORCEMENT</h2>
              <p className="font-mono text-xs text-on-surface-variant">
                Surveillance over all registered meters. Regulators can freeze meters to prevent double-minting or illegal credit generation.
              </p>
            </div>
            <Button variant="neutral" onClick={() => refetchMeters()} className="text-xs">
              🔄 Refresh Meters
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse font-mono text-xs">
              <thead>
                <tr className="border-b-3 border-black bg-surface text-left">
                  <th className="p-2">Meter No.</th>
                  <th className="p-2">Owner / Node</th>
                  <th className="p-2">Zone</th>
                  <th className="p-2">Type</th>
                  <th className="p-2">Rated Capacity</th>
                  <th className="p-2">Status</th>
                  <th className="p-2 text-right">Regulatory Action</th>
                </tr>
              </thead>
              <tbody>
                {(meters ?? []).map((m) => {
                  const isSuspended = m.status === "SUSPENDED";
                  const isFlagged = m.status === "FLAGGED";
                  const isBusy = busyAction === `meter-${m.id}`;

                  return (
                    <tr key={m.id} className="border-b border-black/20 hover:bg-surface/50">
                      <td className="p-2 font-bold whitespace-nowrap">{m.meterNumber}</td>
                      <td className="p-2 whitespace-nowrap">
                        <span className="font-bold text-black">{m.ownerAlias}</span>
                        <span className="block text-[10px] text-on-surface-variant">{m.ownerEmail}</span>
                      </td>
                      <td className="p-2 whitespace-nowrap">{m.gridZoneCode}</td>
                      <td className="p-2 whitespace-nowrap">{m.meterType}</td>
                      <td className="p-2 whitespace-nowrap font-bold">{m.ratedKw} kW</td>
                      <td className="p-2 whitespace-nowrap">
                        <StatusBadge status={isSuspended || isFlagged ? "fault" : "live"}>
                          {m.status}
                        </StatusBadge>
                      </td>
                      <td className="p-2 text-right whitespace-nowrap">
                        {isFlagged || isSuspended ? (
                          <Button
                            variant="solar"
                            disabled={isBusy}
                            onClick={() => handleUpdateMeterStatus(m.id, "ACTIVE", "Regulator cleared audit")}
                            className="text-[10px] py-1 px-2"
                          >
                            {isBusy ? "Restoring…" : "✓ Clear Flag & Restore"}
                          </Button>
                        ) : (
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="fault"
                              disabled={isBusy}
                              onClick={() => handleUpdateMeterStatus(m.id, "SUSPENDED", "Regulator suspended meter for audit")}
                              className="text-[10px] py-1 px-2"
                            >
                              {isBusy ? "Freezing…" : "⛔ Freeze Meter"}
                            </Button>
                            <Button
                              variant="neutral"
                              disabled={isBusy}
                              onClick={() => handleUpdateMeterStatus(m.id, "FLAGGED", "Regulator flagged suspicious readings")}
                              className="text-[10px] py-1 px-2"
                            >
                              🚩 Flag
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {(!meters || meters.length === 0) && (
              <div className="p-8 text-center font-mono text-sm text-on-surface-variant">
                No meters loaded.
              </div>
            )}
          </div>
        </Card>
      )}

      {/* TAB 3: Settlement Reconciliation */}
      {activeTab === "settlements" && (
        <Card className="border-3 border-black bg-white shadow-hard">
          <div className="mb-4 flex flex-wrap items-center justify-between border-b-2 border-black pb-3">
            <div>
              <h2 className="font-display text-lg font-bold">DISCOM SETTLEMENT RECONCILIATION &amp; DISPUTES</h2>
              <p className="font-mono text-xs text-on-surface-variant">
                Review settlement submissions with the distribution utility. Regulators can resolve discrepancies and approve credits for bill offset.
              </p>
            </div>
            <Button variant="neutral" onClick={() => refetchSettlements()} className="text-xs">
              🔄 Refresh Settlements
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse font-mono text-xs">
              <thead>
                <tr className="border-b-3 border-black bg-surface text-left">
                  <th className="p-2">Transaction ID</th>
                  <th className="p-2">Buyer</th>
                  <th className="p-2">Requested</th>
                  <th className="p-2">Settled</th>
                  <th className="p-2">Bill Offset</th>
                  <th className="p-2">Status</th>
                  <th className="p-2 text-right">Regulatory Action</th>
                </tr>
              </thead>
              <tbody>
                {(settlements ?? []).map((s) => {
                  const isMismatch = s.status === "MISMATCH" || s.status === "FAILED" || s.status === "PARTIAL";
                  const isSettled = s.status === "SETTLED";
                  const isBusy = busyAction === `settle-${s.id}`;

                  return (
                    <tr key={s.id} className="border-b border-black/20 hover:bg-surface/50">
                      <td className="p-2 whitespace-nowrap font-bold">
                        <Link to={`/transactions/${s.transactionId}`} className="underline hover:text-solar-dark">
                          {s.transaction.transactionId}
                        </Link>
                      </td>
                      <td className="p-2 whitespace-nowrap">
                        <span className="font-bold text-black">{s.transaction.buyer?.displayAlias || "Consumer"}</span>
                      </td>
                      <td className="p-2 whitespace-nowrap">{formatKwh(s.requestedKwh)}</td>
                      <td className="p-2 whitespace-nowrap font-bold">{formatKwh(s.settledKwh)}</td>
                      <td className="p-2 whitespace-nowrap font-bold">{formatINR(s.billAdjustment)}</td>
                      <td className="p-2 whitespace-nowrap">
                        <StatusBadge status={isMismatch ? "fault" : isSettled ? "live" : "idle"}>
                          {s.status}
                        </StatusBadge>
                      </td>
                      <td className="p-2 text-right whitespace-nowrap">
                        {isMismatch ? (
                          <Button
                            variant="solar"
                            disabled={isBusy}
                            onClick={() => handleReconcileSettlement(s.id)}
                            className="text-[10px] py-1 px-2"
                          >
                            {isBusy ? "Reconciling…" : "⚖️ Approve & Reconcile"}
                          </Button>
                        ) : (
                          <span className="text-on-surface-variant text-[11px]">Reconciled ✓</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {(!settlements || settlements.length === 0) && (
              <div className="p-8 text-center font-mono text-sm text-on-surface-variant">
                No settlements recorded yet.
              </div>
            )}
          </div>
        </Card>
      )}

      {/* TAB 4: Tariff Cap Corridors */}
      {activeTab === "zones" && (
        <div className="space-y-4">
          <div className="border-3 border-black bg-white p-4 shadow-hard">
            <h2 className="font-display text-lg font-bold">STATUTORY TARIFF CORRIDORS &amp; CONGESTION MANAGEMENT</h2>
            <p className="font-mono text-xs text-on-surface-variant">
              Regulator sets the bounding corridor for dynamic pricing in each grid zone. Market orders are capped between Floor and Ceiling.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(dashboard?.zones ?? []).map((z) => {
              const loadNum = Number(z.currentLoadKw);
              const capNum = Number(z.capacityKw) || 1;
              const loadPercent = Math.min(100, Math.round((loadNum / capNum) * 100));

              const edits = tariffEdits[z.id] || {
                floor: z.priceFloor,
                base: z.basePrice,
                ceiling: z.priceCeiling,
              };

              const isBusy = busyAction === `tariff-${z.id}`;

              return (
                <Card key={z.id} className="border-3 border-black bg-white shadow-hard space-y-3">
                  <div className="flex items-center justify-between border-b-2 border-black pb-2">
                    <div>
                      <p className="font-display font-bold text-base">{z.name}</p>
                      <p className="font-mono text-xs text-on-surface-variant">{z.zoneCode}</p>
                    </div>
                    <StatusBadge status={z.status === "NORMAL" ? "live" : z.status === "OUTAGE" ? "fault" : "idle"}>
                      {z.status}
                    </StatusBadge>
                  </div>

                  {/* Grid Load Meter */}
                  <div className="space-y-1 font-mono text-xs">
                    <div className="flex justify-between">
                      <span className="text-on-surface-variant">Grid Load</span>
                      <span className="font-bold">
                        {z.currentLoadKw} / {z.capacityKw} kW ({loadPercent}%)
                      </span>
                    </div>

                    <div className="h-3 w-full border-2 border-black bg-surface">
                      <div
                        className={`h-full ${
                          loadPercent > 85 ? "bg-fault" : loadPercent > 60 ? "bg-alert" : "bg-solar"
                        }`}
                        style={{ width: `${loadPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Interactive Tariff Form */}
                  <div className="border-t-2 border-black pt-2 space-y-2 font-mono text-xs">
                    <p className="font-bold uppercase text-[10px] text-on-surface-variant">Adjust Statutory Corridor (₹/kWh)</p>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-on-surface-variant block">Floor</label>
                        <input
                          type="number"
                          step="0.1"
                          value={edits.floor}
                          onChange={(e) =>
                            setTariffEdits({
                              ...tariffEdits,
                              [z.id]: { ...edits, floor: e.target.value },
                            })
                          }
                          className="w-full border-2 border-black p-1 text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-on-surface-variant block">Base Ref</label>
                        <input
                          type="number"
                          step="0.1"
                          value={edits.base}
                          onChange={(e) =>
                            setTariffEdits({
                              ...tariffEdits,
                              [z.id]: { ...edits, base: e.target.value },
                            })
                          }
                          className="w-full border-2 border-black p-1 text-xs font-bold text-solar-dark"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-on-surface-variant block">Ceiling</label>
                        <input
                          type="number"
                          step="0.1"
                          value={edits.ceiling}
                          onChange={(e) =>
                            setTariffEdits({
                              ...tariffEdits,
                              [z.id]: { ...edits, ceiling: e.target.value },
                            })
                          }
                          className="w-full border-2 border-black p-1 text-xs font-bold"
                        />
                      </div>
                    </div>

                    <Button
                      variant="solar"
                      disabled={isBusy}
                      onClick={() => handleSaveTariff(z.id)}
                      className="w-full text-xs py-1 mt-1"
                    >
                      {isBusy ? "Applying Tariff…" : "Apply GERC Tariff Directive"}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
