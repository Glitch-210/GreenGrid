import { Link } from "react-router-dom";
import { MetricTile } from "../../components/ui/MetricTile";
import { Button } from "../../components/ui/Button";
import { useApiQuery } from "../../hooks/useApi";
import { formatINR, formatKwh } from "../../lib/format";

interface ConsumerDashboardData {
  totalPurchasedKwh: string;
  totalSpent: string;
  totalBillAdjustment: string;
  transactionCount: number;
}

export default function ConsumerDashboard() {
  const { data } = useApiQuery<ConsumerDashboardData>(["dashboard", "consumer"], "/users/dashboard");

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">CONSUMER OVERVIEW</h1>
      <p className="mb-4 font-mono text-xs uppercase tracking-wider text-on-surface-variant">
        P2P purchases &amp; DISCOM bill savings
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricTile label="Purchased" value={data ? formatKwh(data.totalPurchasedKwh) : "—"} />
        <MetricTile label="Total spent" value={data ? formatINR(data.totalSpent) : "—"} />
        <MetricTile
          label="Bill adjustment (savings)"
          value={data ? formatINR(data.totalBillAdjustment) : "—"}
          delta={`${data?.transactionCount ?? 0} transactions`}
        />
      </div>
      <div className="mt-6">
        <Link to="/marketplace">
          <Button variant="solar">Browse marketplace</Button>
        </Link>
      </div>
    </div>
  );
}
