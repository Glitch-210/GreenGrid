import { Link } from "react-router-dom";
import { PageShell } from "../../components/ui/PageShell";
import { Card } from "../../components/ui/Card";
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
    <PageShell title="Consumer dashboard">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-neutral-400">Purchased</p>
          <p className="text-2xl font-semibold">{data ? formatKwh(data.totalPurchasedKwh) : "—"}</p>
        </Card>
        <Card>
          <p className="text-sm text-neutral-400">Total spent</p>
          <p className="text-2xl font-semibold">{data ? formatINR(data.totalSpent) : "—"}</p>
        </Card>
        <Card>
          <p className="text-sm text-neutral-400">Bill adjustment (savings)</p>
          <p className="text-2xl font-semibold text-energy-green">{data ? formatINR(data.totalBillAdjustment) : "—"}</p>
        </Card>
      </div>
      <div className="mt-6">
        <Link className="text-energy-green underline" to="/consumer/marketplace">
          Browse marketplace
        </Link>
      </div>
    </PageShell>
  );
}
