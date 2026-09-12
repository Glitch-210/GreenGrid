import { PageShell } from "../../components/ui/PageShell";
import { Card } from "../../components/ui/Card";
import { useApiQuery } from "../../hooks/useApi";
import type { EnergyCreditDTO } from "@wattshare/shared";

export default function ProsumerCredits() {
  const { data } = useApiQuery<EnergyCreditDTO[]>(["credits", "mine"], "/credits");

  return (
    <PageShell title="My energy credits">
      <div className="grid gap-3">
        {(data ?? []).map((c) => (
          <Card key={c.id} className="flex items-center justify-between">
            <div>
              <p className="font-mono text-sm">{c.creditId}</p>
              <p className="text-xs text-neutral-400">expires {new Date(c.expiresAt).toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-sm">{c.status}</p>
              <p className="text-xs text-neutral-400">avail {c.availableKwh} kWh</p>
            </div>
          </Card>
        ))}
        {data?.length === 0 && <p className="text-neutral-400">No credits yet — surplus solar generation mints credits automatically.</p>}
      </div>
    </PageShell>
  );
}
