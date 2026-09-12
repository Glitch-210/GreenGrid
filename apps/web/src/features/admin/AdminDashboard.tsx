import { useState } from "react";
import { PageShell } from "../../components/ui/PageShell";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
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
    <PageShell title="Admin / Regulator">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card>
          <p className="text-sm text-neutral-400">Users</p>
          <p className="text-2xl font-semibold">{data?.userCount ?? "—"}</p>
        </Card>
        <Card>
          <p className="text-sm text-neutral-400">Transactions</p>
          <p className="text-2xl font-semibold">{data?.transactionCount ?? "—"}</p>
        </Card>
        <Card>
          <p className="text-sm text-neutral-400">Flagged readings</p>
          <p className="text-2xl font-semibold text-amber-400">{data?.flaggedReadings ?? "—"}</p>
        </Card>
        <Card>
          <p className="text-sm text-neutral-400">Settlement mismatches</p>
          <p className="text-2xl font-semibold text-red-400">{data?.settlementMismatches ?? "—"}</p>
        </Card>
      </div>

      <Card className="mt-6">
        <p className="mb-3 font-medium">Demo control panel</p>
        <div className="flex flex-wrap gap-2">
          <Button disabled={!!busy} onClick={() => run("reset", () => api.post("/demo/reset"))}>
            Reset data
          </Button>
          <Button disabled={!!busy} onClick={() => run("clock", () => api.post("/demo/clock", { hour: 13 }))}>
            Jump to 13:00
          </Button>
          <Button disabled={!!busy} onClick={() => run("congest", () => api.post("/demo/congest", { zoneCode: "GZ-AHM-W", congested: true }))}>
            Congest GZ-01
          </Button>
          <Button disabled={!!busy} onClick={() => run("discom-down", () => api.post("/demo/discom", { mode: "down" }))}>
            DISCOM down
          </Button>
          <Button disabled={!!busy} onClick={() => run("discom-partial", () => api.post("/demo/discom", { mode: "partial" }))}>
            DISCOM partial
          </Button>
          <Button disabled={!!busy} onClick={() => run("discom-ok", () => api.post("/demo/discom", { mode: "ok" }))}>
            DISCOM ok
          </Button>
        </div>
      </Card>
    </PageShell>
  );
}
