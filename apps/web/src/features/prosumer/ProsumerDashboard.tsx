import { Link } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { MetricTile } from "../../components/ui/MetricTile";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { useApiQuery } from "../../hooks/useApi";
import { useAuth } from "../../hooks/useAuth";
import { formatEC, formatINR } from "../../lib/format";

interface ProsumerDashboardData {
  creditBalance: { available: string; listable: string; reserved: string; sold: string; retired: string };
  totalEarnings: string;
  creditCount: number;
}

export default function ProsumerDashboard() {
  const { user } = useAuth();
  const { data } = useApiQuery<ProsumerDashboardData>(["dashboard", "prosumer"], "/users/dashboard");

  const available = Number(data?.creditBalance.available ?? 0);
  const reserved = Number(data?.creditBalance.reserved ?? 0);
  const sold = Number(data?.creditBalance.sold ?? 0);
  const retired = Number(data?.creditBalance.retired ?? 0);
  // The balance invariant is available + reserved + sold + retired == quantity.
  // Dropping retired made every bar a percentage of the wrong denominator.
  const total = available + reserved + sold + retired || 1;
  // What the seller can actually list right now — the same number /prosumer/sell
  // offers. `available` still counts expired, frozen and already-listed quantity.
  const listable = Number(data?.creditBalance.listable ?? 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-3 border-black bg-white px-3 py-2 shadow-hard">
        <p className="font-mono text-xs font-bold uppercase tracking-wider">
          Prosumer Node — {user?.displayAlias ?? "…"}
        </p>
        <StatusBadge status="live">Online</StatusBadge>
      </div>

      <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">EC PORTFOLIO BREAKDOWN</h1>
      <p className="mb-4 font-mono text-xs uppercase tracking-wider text-on-surface-variant">
        Verified surplus &amp; market position
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile
          label="Avail to Sell"
          value={data ? formatEC(data.creditBalance.listable) : "—"}
          delta={listable > 0 ? "Ready for market" : "Nothing listable"}
        />
        <MetricTile label="In Escrow" value={data ? formatEC(data.creditBalance.reserved) : "—"} delta="Listed on market" />
        <MetricTile label="Total Sold" value={data ? formatEC(data.creditBalance.sold) : "—"} delta={`${data?.creditCount ?? 0} credit batches`} />
        <MetricTile label="Accrued Value" value={data ? formatINR(data.totalEarnings) : "—"} delta="Net DISCOM offset" />
      </div>

      {data && (
        <div className="mt-4 grid gap-3 border-3 border-black bg-white p-4 shadow-hard sm:grid-cols-2 lg:grid-cols-4">
          <ProgressBar label="Available" percent={(available / total) * 100} color="solar" />
          <ProgressBar label="In Escrow" percent={(reserved / total) * 100} color="grid" />
          <ProgressBar label="Sold" percent={(sold / total) * 100} color="solar" />
          <ProgressBar label="Retired" percent={(retired / total) * 100} color="grid" />
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <Link to="/prosumer/sell">
          <Button variant="solar">
            Sell surplus energy credits{data ? ` (${formatEC(data.creditBalance.listable)})` : ""}
          </Button>
        </Link>
        <Link to="/prosumer/listings">
          <Button variant="grid">My listings</Button>
        </Link>
        <Link to="/prosumer/credits">
          <Button variant="neutral">View credit batches</Button>
        </Link>
      </div>
    </div>
  );
}
