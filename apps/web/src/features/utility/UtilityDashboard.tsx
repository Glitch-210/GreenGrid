import { PageShell } from "../../components/ui/PageShell";
import { Card } from "../../components/ui/Card";
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
    <PageShell title="Utility dashboard">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(data?.zones ?? []).map((z) => (
          <Card key={z.zoneCode}>
            <p className="font-medium">{z.name}</p>
            <p className="text-xs text-neutral-400">{z.zoneCode} · {z.status}</p>
            <p className="mt-2 text-sm">
              Load {z.currentLoadKw} / {z.capacityKw} kW
            </p>
          </Card>
        ))}
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-sm text-neutral-400">Settlement queue</p>
          <p className="text-2xl font-semibold">{data?.settlementQueueSize ?? "—"}</p>
        </Card>
        <Card>
          <p className="text-sm text-neutral-400">Total P2P traded</p>
          <p className="text-2xl font-semibold">{data ? formatKwh(data.totalP2PTradedKwh) : "—"}</p>
        </Card>
      </div>
    </PageShell>
  );
}
