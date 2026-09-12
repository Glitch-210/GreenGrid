import { useNavigate } from "react-router-dom";
import { PageShell } from "../../components/ui/PageShell";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { useApiQuery } from "../../hooks/useApi";
import type { MarketplaceListingDTO } from "@wattshare/shared";

export default function ConsumerMarketplace() {
  const { data } = useApiQuery<MarketplaceListingDTO[]>(["marketplace", "listings"], "/marketplace/listings");
  const navigate = useNavigate();

  return (
    <PageShell title="Marketplace">
      <div className="mb-4">
        <Button onClick={() => navigate("/consumer/checkout")}>Auto-match my requirement</Button>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(data ?? []).map((l) => (
          <Card key={l.id}>
            <p className="font-medium">{l.sellerAlias}</p>
            <p className="text-sm text-neutral-400">{l.zoneName}</p>
            <p className="mt-2 text-xl font-semibold">₹{l.pricePerKwh} / kWh</p>
            <p className="text-sm text-neutral-400">{l.remainingKwh} kWh remaining</p>
          </Card>
        ))}
        {data?.length === 0 && <p className="text-neutral-400">No active listings right now.</p>}
      </div>
    </PageShell>
  );
}
