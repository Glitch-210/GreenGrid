import { Card } from "../../components/ui/Card";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { useApiQuery } from "../../hooks/useApi";
import type { EnergyCreditDTO } from "@wattshare/shared";

export default function ProsumerCredits() {
  const { data } = useApiQuery<EnergyCreditDTO[]>(["credits", "mine"], "/credits");

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">MY ENERGY CREDITS</h1>
      <p className="mb-4 font-mono text-xs uppercase tracking-wider text-on-surface-variant">
        Verified credit batches minted from smart meter surplus
      </p>
      <div className="grid gap-3">
        {(data ?? []).map((c) => (
          <Card key={c.id} className="flex items-center justify-between">
            <div>
              <p className="font-mono text-sm font-bold">{c.creditId}</p>
              <p className="font-mono text-xs text-on-surface-variant">expires {new Date(c.expiresAt).toLocaleString()}</p>
            </div>
            <div className="text-right">
              <StatusBadge status={c.status === "AVAILABLE" || c.status === "LISTED" ? "live" : "idle"}>
                {c.status}
              </StatusBadge>
              <p className="mt-1 font-mono text-xs text-on-surface-variant">avail {c.availableKwh} kWh</p>
            </div>
          </Card>
        ))}
        {data?.length === 0 && (
          <p className="text-on-surface-variant">No credits yet — surplus solar generation mints credits automatically.</p>
        )}
      </div>
    </div>
  );
}
