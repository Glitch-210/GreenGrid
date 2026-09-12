import { Card } from "../../components/ui/Card";
import { MetricTile } from "../../components/ui/MetricTile";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { useApiQuery } from "../../hooks/useApi";
import { formatKwh } from "../../lib/format";

interface UtilityDashboardData {
  zones: { zoneCode: string; name: string; capacityKw: string; currentLoadKw: string; status: string }[];
  settlementQueueSize: number;
  totalP2PTradedKwh: string;
}

export default function UtilityDashboard() {
  const { data } = useApiQuery<UtilityDashboardData>(["dashboard", "utility"], "/users/dashboard");

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">UTILITY GRID STATUS</h1>
      <p className="mb-4 font-mono text-xs uppercase tracking-wider text-on-surface-variant">Zone load &amp; settlement queue</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(data?.zones ?? []).map((z) => (
          <Card key={z.zoneCode}>
            <div className="flex items-center justify-between">
              <p className="font-display font-bold">{z.name}</p>
              <StatusBadge status={z.status === "NORMAL" ? "live" : z.status === "OUTAGE" ? "fault" : "idle"}>
                {z.status}
              </StatusBadge>
            </div>
            <p className="font-mono text-xs text-on-surface-variant">{z.zoneCode}</p>
            <p className="mt-2 font-mono text-sm font-bold">
              Load {z.currentLoadKw} / {z.capacityKw} kW
            </p>
          </Card>
        ))}
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MetricTile label="Settlement queue" value={data?.settlementQueueSize ?? "—"} />
        <MetricTile label="Total P2P traded" value={data ? formatKwh(data.totalP2PTradedKwh) : "—"} />
      </div>
    </div>
  );
}
