import { Link } from "react-router-dom";
import { PageShell } from "../../components/ui/PageShell";
import { Card } from "../../components/ui/Card";
import { useApiQuery } from "../../hooks/useApi";
import { formatEC, formatINR } from "../../lib/format";

interface ProsumerDashboardData {
  creditBalance: { available: string; reserved: string; sold: string; retired: string };
  totalEarnings: string;
  creditCount: number;
}

export default function ProsumerDashboard() {
  const { data } = useApiQuery<ProsumerDashboardData>(["dashboard", "prosumer"], "/users/dashboard");

  return (
    <PageShell title="Prosumer dashboard">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-neutral-400">Available EC</p>
          <p className="text-2xl font-semibold">{data ? formatEC(data.creditBalance.available) : "—"}</p>
        </Card>
        <Card>
          <p className="text-sm text-neutral-400">Total earnings</p>
          <p className="text-2xl font-semibold">{data ? formatINR(data.totalEarnings) : "—"}</p>
        </Card>
        <Card>
          <p className="text-sm text-neutral-400">Credit batches</p>
          <p className="text-2xl font-semibold">{data?.creditCount ?? "—"}</p>
        </Card>
      </div>
      <div className="mt-6 flex gap-3">
        <Link className="text-energy-green underline" to="/prosumer/credits">
          View credits
        </Link>
        <Link className="text-energy-green underline" to="/prosumer/sell">
          List EC for sale
        </Link>
      </div>
    </PageShell>
  );
}
