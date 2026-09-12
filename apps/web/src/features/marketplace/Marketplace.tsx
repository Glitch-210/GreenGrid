import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { useApiQuery, useApiMutation, apiErrorMessage } from "../../hooks/useApi";
import { formatINR } from "../../lib/format";
import type { MarketplaceListingDTO } from "@wattshare/shared";

type SortMode = "price_asc" | "price_desc" | "newest";

export default function Marketplace() {
  const navigate = useNavigate();
  const { data } = useApiQuery<MarketplaceListingDTO[]>(["marketplace", "listings"], "/marketplace/listings");

  const [search, setSearch] = useState("");
  const [minQty, setMinQty] = useState(0);
  const [sort, setSort] = useState<SortMode>("price_asc");
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A purchase moves the listing's remaining quantity and both parties' balances.
  const invalidates = [["marketplace", "listings"], ["dashboard", "prosumer"], ["transactions", "mine"], ["credits", "sellable"]];
  const reserve = useApiMutation<{ allocations: { listingId: string; kwh: number }[] }, { id: string }>(
    "post",
    "/transactions",
    { invalidates, headers: () => ({ "Idempotency-Key": crypto.randomUUID() }) },
  );
  const pay = useApiMutation<{ transactionId: string }>("post", "/payments", {
    invalidates,
    headers: () => ({ "Idempotency-Key": crypto.randomUUID() }),
  });

  const listings = useMemo(() => {
    let rows = (data ?? []).filter((l) => Number(l.remainingKwh) >= minQty);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((l) => l.sellerAlias.toLowerCase().includes(q) || l.zoneName.toLowerCase().includes(q));
    }
    rows = [...rows].sort((a, b) => {
      if (sort === "price_asc") return Number(a.pricePerKwh) - Number(b.pricePerKwh);
      if (sort === "price_desc") return Number(b.pricePerKwh) - Number(a.pricePerKwh);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return rows;
  }, [data, search, minQty, sort]);

  async function buy(listing: MarketplaceListingDTO) {
    setError(null);
    setBuyingId(listing.id);
    try {
      // Two writes, so they're driven imperatively rather than as one mutation —
      // but both go through the hook so the cache invalidation still happens.
      const txn = await reserve.mutateAsync({
        allocations: [{ listingId: listing.id, kwh: Number(listing.remainingKwh) }],
      });
      await pay.mutateAsync({ transactionId: txn.id });
      navigate(`/transactions/${txn.id}`);
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to buy credits"));
    } finally {
      setBuyingId(null);
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">LOCAL ENERGY CREDIT MARKET</h1>
      <p className="mb-4 font-mono text-xs uppercase tracking-wider text-on-surface-variant">
        {listings.length} active listing{listings.length === 1 ? "" : "s"}
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          className="min-w-[200px] flex-1 border-3 border-black bg-white px-3 py-2 font-mono text-sm"
          placeholder="Filter by prosumer or zone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="border-3 border-black bg-white px-3 py-2 font-mono text-xs uppercase"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortMode)}
        >
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
          <option value="newest">Newest</option>
        </select>
        <select
          className="border-3 border-black bg-white px-3 py-2 font-mono text-xs uppercase"
          value={minQty}
          onChange={(e) => setMinQty(Number(e.target.value))}
        >
          <option value={0}>Any quantity</option>
          <option value={3}>Min 3 EC</option>
          <option value={5}>Min 5 EC</option>
        </select>
      </div>

      {error && <p className="mb-4 font-mono text-sm text-fault">{error}</p>}

      <div className="mb-4">
        <Link to="/consumer/checkout">
          <Button variant="grid">Auto-match my requirement</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {listings.map((l) => (
          <Card key={l.id} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="font-display text-lg font-bold">{l.sellerAlias}</p>
              <StatusBadge status={l.isOwn ? "idle" : "live"}>{l.isOwn ? "Your listing" : "Verified"}</StatusBadge>
            </div>
            <p className="font-mono text-xs uppercase text-on-surface-variant">{l.zoneName}</p>
            <div className="flex items-baseline justify-between border-t-2 border-black pt-2">
              <span className="font-mono text-xs uppercase text-on-surface-variant">Available</span>
              <span className="font-display text-xl font-extrabold">{l.remainingKwh} EC</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-xs uppercase text-on-surface-variant">Unit price</span>
              <span className="font-mono font-bold">{formatINR(l.pricePerKwh)} / EC</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-xs uppercase text-on-surface-variant">Total</span>
              <span className="font-mono font-bold">{formatINR(Number(l.remainingKwh) * Number(l.pricePerKwh))}</span>
            </div>
            {/* Own listings stay visible (useful feedback that it's on the market)
                but can't be bought — the server rejects it with SELF_TRADE anyway. */}
            <Button
              variant={l.isOwn ? "neutral" : "solar"}
              className="mt-2"
              disabled={l.isOwn || buyingId === l.id}
              onClick={() => buy(l)}
            >
              {l.isOwn ? "Your own listing" : buyingId === l.id ? "Processing…" : "Buy credits"}
            </Button>
          </Card>
        ))}
        {listings.length === 0 && <p className="text-on-surface-variant">No active listings match your filters.</p>}
      </div>
    </div>
  );
}
