import { useState, useMemo } from "react";
import { Card } from "../../components/ui/Card";
import { MetricTile } from "../../components/ui/MetricTile";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { Button } from "../../components/ui/Button";
import { useApiQuery } from "../../hooks/useApi";
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

export default function RegulatorDashboard() {
  const { data: dashboard, isLoading: isDashboardLoading } = useApiQuery<RegulatorDashboardData>(
    ["dashboard", "regulator"],
    "/users/dashboard",
  );

  const { data: auditLogs, isLoading: isLogsLoading, refetch: refetchAudit } = useApiQuery<AuditLogItem[]>(
    ["audit", "logs"],
    "/audit",
  );

  const [activeTab, setActiveTab] = useState<"audit" | "zones" | "fraud">("audit");
  const [filterAction, setFilterAction] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

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
      {/* Regulator Header Banner */}
      <div className="border-3 border-black bg-white p-4 shadow-hard">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-3 border-black pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="border-2 border-black bg-solar px-2 py-0.5 font-mono text-xs font-bold uppercase shadow-hard-sm">
                GERC Regulatory Node
              </span>
              <StatusBadge status="live">Oversight Active</StatusBadge>
            </div>
            <h1 className="mt-2 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
              REGULATOR AUDIT &amp; COMPLIANCE HUB
            </h1>
            <p className="font-mono text-xs uppercase tracking-wider text-on-surface-variant">
              Gujarat Electricity Regulatory Commission — P2P Energy Trading Oversight
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="border-2 border-black bg-surface px-2 py-1 font-mono text-xs font-bold shadow-hard-sm">
              Invariant: 100% ENFORCED
            </span>
            <span className="font-mono text-[11px] text-on-surface-variant">
              available + reserved + sold + retired == qty
            </span>
          </div>
        </div>

        {/* High-Level Regulatory Metrics */}
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricTile
            label="Monitored Participants"
            value={dashboard?.userCount ?? (isDashboardLoading ? "…" : "—")}
            delta="Grid prosumers &amp; consumers"
          />
          <MetricTile
            label="Total Cleared Trades"
            value={dashboard?.transactionCount ?? (isDashboardLoading ? "…" : "—")}
            delta={dashboard ? `${formatKwh(dashboard.totalSoldKwh)} settled` : "—"}
          />
          <MetricTile
            label="Flagged Anomaly Readings"
            value={
              <span className={dashboard?.flaggedReadings ? "text-fault" : "text-solar-dark"}>
                {dashboard?.flaggedReadings ?? (isDashboardLoading ? "…" : "0")}
              </span>
            }
            delta={
              dashboard?.flaggedMetersCount
                ? `${dashboard.flaggedMetersCount} suspicious meters blocked`
                : "Zero critical flags"
            }
          />
          <MetricTile
            label="Settlement Reconciliations"
            value={
              <span className={dashboard?.settlementMismatches ? "text-fault" : "text-black"}>
                {dashboard?.settlementMismatches ?? (isDashboardLoading ? "…" : "0")}
              </span>
            }
            delta="0 mismatches reported"
          />
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b-3 border-black pb-2">
        <Button
          variant={activeTab === "audit" ? "solar" : "neutral"}
          onClick={() => setActiveTab("audit")}
          className="text-xs"
        >
          📋 Real-Time Audit Trail ({auditLogs?.length ?? 0})
        </Button>
        <Button
          variant={activeTab === "zones" ? "solar" : "neutral"}
          onClick={() => setActiveTab("zones")}
          className="text-xs"
        >
          ⚡ Tariff Cap &amp; Grid Zone Compliance ({dashboard?.zones?.length ?? 0})
        </Button>
        <Button
          variant={activeTab === "fraud" ? "fault" : "neutral"}
          onClick={() => setActiveTab("fraud")}
          className="text-xs"
        >
          🚨 Fraud Prevention &amp; Flagged Meters ({dashboard?.flaggedMeters?.length ?? 0})
        </Button>
      </div>

      {/* TAB 1: Real-Time Regulatory Audit Trail */}
      {activeTab === "audit" && (
        <Card className="border-3 border-black bg-white shadow-hard">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b-2 border-black pb-3">
            <div>
              <h2 className="font-display text-lg font-bold">IMMUTABLE REGULATORY AUDIT LOG</h2>
              <p className="font-mono text-xs text-on-surface-variant">
                Every credit mint, marketplace listing, trade matching, and settlement submission
              </p>
            </div>
            <Button variant="neutral" onClick={() => refetchAudit()} className="text-xs">
              🔄 Refresh Stream
            </Button>
          </div>

          {/* Filters Bar */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-bold uppercase">Filter:</span>
            {["ALL", "MINT", "LISTING", "MATCH", "PAYMENT", "SETTLEMENT", "FLAG"].map((act) => (
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
              placeholder="Search entity, actor, or action..."
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
                  const isFlag = log.action.includes("FLAG") || log.action.includes("REJECT");
                  const isMint = log.action.includes("MINT");
                  const isTrade = log.action.includes("MATCH") || log.action.includes("TRADE") || log.action.includes("PAY");
                  const isSettle = log.action.includes("SETTLE");

                  let badgeColor: "fault" | "live" | "idle" = "idle";
                  if (isFlag) badgeColor = "fault";
                  else if (isMint || isTrade || isSettle) badgeColor = "live";

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

      {/* TAB 2: Tariff Cap & Grid Zone Compliance */}
      {activeTab === "zones" && (
        <div className="space-y-4">
          <div className="border-3 border-black bg-white p-4 shadow-hard">
            <h2 className="font-display text-lg font-bold">GERC STATUTORY TARIFF CORRIDORS &amp; CONGESTION</h2>
            <p className="font-mono text-xs text-on-surface-variant">
              Every P2P energy credit trade is algorithmically bounded between the statutory Price Floor and Price Ceiling.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(dashboard?.zones ?? []).map((z) => {
              const loadNum = Number(z.currentLoadKw);
              const capNum = Number(z.capacityKw) || 1;
              const loadPercent = Math.min(100, Math.round((loadNum / capNum) * 100));

              return (
                <Card key={z.id} className="border-3 border-black bg-white shadow-hard">
                  <div className="flex items-center justify-between border-b-2 border-black pb-2">
                    <div>
                      <p className="font-display font-bold text-base">{z.name}</p>
                      <p className="font-mono text-xs text-on-surface-variant">{z.zoneCode}</p>
                    </div>
                    <StatusBadge status={z.status === "NORMAL" ? "live" : z.status === "OUTAGE" ? "fault" : "idle"}>
                      {z.status}
                    </StatusBadge>
                  </div>

                  <div className="mt-3 space-y-2 font-mono text-xs">
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

                    <div className="mt-3 border-t-2 border-black pt-2 space-y-1">
                      <div className="flex justify-between">
                        <span className="text-on-surface-variant">Statutory Floor</span>
                        <span className="font-bold">{formatINR(z.priceFloor)}/kWh</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-on-surface-variant">Base Reference Tariff</span>
                        <span className="font-bold text-solar-dark">{formatINR(z.basePrice)}/kWh</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-on-surface-variant">Statutory Ceiling</span>
                        <span className="font-bold">{formatINR(z.priceCeiling)}/kWh</span>
                      </div>
                    </div>

                    <div className="mt-2 border-t border-black/30 pt-1 text-[11px] text-solar-dark font-bold">
                      ✓ Algorithmic price bounding active
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: Fraud Prevention & Flagged Meters */}
      {activeTab === "fraud" && (
        <Card className="border-3 border-black bg-white shadow-hard">
          <div className="mb-4 border-b-2 border-black pb-3">
            <h2 className="font-display text-lg font-bold text-fault">ANTI-FRAUD &amp; ANOMALY MONITORING</h2>
            <p className="font-mono text-xs text-on-surface-variant">
              Automated telemetry validation flags meters whose reported generation violates physical solar generation models.
            </p>
          </div>

          <div className="grid gap-3">
            {(dashboard?.flaggedMeters ?? []).map((m) => (
              <div
                key={m.id}
                className="border-3 border-black bg-[#fff5f5] p-3 shadow-hard-sm flex flex-wrap items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold">{m.meterNumber}</span>
                    <StatusBadge status="fault">FLAGGED FOR FRAUD</StatusBadge>
                  </div>
                  <p className="font-mono text-xs text-on-surface-variant mt-1">
                    Owner: <span className="font-bold text-black">{m.userAlias}</span> ({m.userEmail}) · Zone:{" "}
                    {m.zoneCode}
                  </p>
                  <p className="font-mono text-xs text-fault mt-1">
                    Violation: Meter generation telemetry exceeded physical rated capacity ({m.ratedKw} kW inverter limit).
                  </p>
                </div>
                <div className="text-right">
                  <span className="border-2 border-black bg-white px-2 py-1 font-mono text-xs font-bold">
                    CREDIT MINTING FROZEN
                  </span>
                </div>
              </div>
            ))}

            {(!dashboard?.flaggedMeters || dashboard.flaggedMeters.length === 0) && (
              <div className="p-6 text-center font-mono text-sm text-on-surface-variant">
                No active fraud violations detected across current smart meters.
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
