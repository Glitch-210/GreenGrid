import { useState } from "react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { MetricTile } from "../../components/ui/MetricTile";
import { useApiQuery } from "../../hooks/useApi";
import { api } from "../../lib/api";

interface AdminDashboardData {
  userCount: number;
  transactionCount: number;
  flaggedReadings: number;
  settlementMismatches: number;
}

export default function AdminDashboard() {
  const { data } = useApiQuery<AdminDashboardData>(["dashboard", "admin"], "/users/dashboard");
  const [busy, setBusy] = useState<string | null>(null);

  async function run(action: string, req: () => Promise<unknown>) {
    setBusy(action);
    try {
      await req();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">ADMIN / REGULATOR</h1>
      <p className="mb-4 font-mono text-xs uppercase tracking-wider text-on-surface-variant">Platform-wide audit &amp; controls</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <MetricTile label="Users" value={data?.userCount ?? "—"} />
        <MetricTile label="Transactions" value={data?.transactionCount ?? "—"} />
        <MetricTile label="Flagged readings" value={<span className="text-[#92720a]">{data?.flaggedReadings ?? "—"}</span>} />
        <MetricTile label="Settlement mismatches" value={<span className="text-fault">{data?.settlementMismatches ?? "—"}</span>} />
      </div>

      <Card className="mt-6 border-black bg-[#1b1b1b] text-white">
        <p className="mb-3 font-mono text-xs font-bold uppercase tracking-wider">Demo control panel</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="grid" disabled={!!busy} onClick={() => run("reset", () => api.post("/demo/reset"))}>
            Reset data
          </Button>
          <Button variant="grid" disabled={!!busy} onClick={() => run("clock", () => api.post("/demo/clock", { hour: 13 }))}>
            Jump to 13:00
          </Button>
          <Button variant="fault" disabled={!!busy} onClick={() => run("congest", () => api.post("/demo/congest", { zoneCode: "GZ-AHM-W", congested: true }))}>
            Congest GZ-01
          </Button>
          <Button variant="fault" disabled={!!busy} onClick={() => run("discom-down", () => api.post("/demo/discom", { mode: "down" }))}>
            DISCOM down
          </Button>
          <Button variant="neutral" disabled={!!busy} onClick={() => run("discom-partial", () => api.post("/demo/discom", { mode: "partial" }))}>
            DISCOM partial
          </Button>
          <Button variant="solar" disabled={!!busy} onClick={() => run("discom-ok", () => api.post("/demo/discom", { mode: "ok" }))}>
            DISCOM ok
          </Button>
        </div>
      </Card>
    </div>
  );
}
