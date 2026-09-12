import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "../../components/ui/PageShell";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { api } from "../../lib/api";
import type { MatchPreviewDTO } from "@wattshare/shared";

export default function ConsumerCheckout() {
  const [quantityKwh, setQuantityKwh] = useState("500");
  const [gridZoneId, setGridZoneId] = useState("");
  const [preview, setPreview] = useState<MatchPreviewDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function findMatches() {
    setError(null);
    try {
      const res = await api.post("/matching/find", { quantityKwh: Number(quantityKwh), gridZoneId });
      setPreview(res.data.data);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Failed to find matches");
    }
  }

  async function confirm() {
    if (!preview) return;
    setError(null);
    try {
      const res = await api.post(
        "/transactions",
        { allocations: preview.allocations.map((a) => ({ listingId: a.listingId, kwh: Number(a.kwh) })) },
        { headers: { "Idempotency-Key": crypto.randomUUID() } },
      );
      navigate(`/consumer/transactions/${res.data.data.id}`);
    } catch (err: any) {
      if (err?.response?.data?.errorCode === "GRID_CONGESTED") {
        setError(`Grid congested — only ${err.response.data.message}`);
      } else {
        setError(err?.response?.data?.message ?? "Failed to create transaction");
      }
    }
  }

  return (
    <PageShell title="Checkout">
      <Card className="max-w-xl">
        <div className="flex gap-3">
          <input className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2" placeholder="quantity (kWh)" value={quantityKwh} onChange={(e) => setQuantityKwh(e.target.value)} />
          <input className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2" placeholder="grid zone id" value={gridZoneId} onChange={(e) => setGridZoneId(e.target.value)} />
          <Button onClick={findMatches}>Find matches</Button>
        </div>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        {preview && (
          <div className="mt-4">
            <table className="w-full text-sm">
              <thead className="text-neutral-400">
                <tr>
                  <th className="text-left">Seller</th>
                  <th className="text-right">kWh</th>
                  <th className="text-right">₹/kWh</th>
                </tr>
              </thead>
              <tbody>
                {preview.allocations.map((a) => (
                  <tr key={a.listingId}>
                    <td>{a.sellerAlias}</td>
                    <td className="text-right">{a.kwh}</td>
                    <td className="text-right">{a.price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-sm text-neutral-400">
              Weighted avg price: ₹{preview.weightedAvgPrice} · Filled {preview.filledKwh} kWh
              {Number(preview.unfilledKwh) > 0 && ` · ${preview.unfilledKwh} kWh from normal grid supply`}
            </p>
            <Button className="mt-3" onClick={confirm}>
              Confirm purchase
            </Button>
          </div>
        )}
      </Card>
    </PageShell>
  );
}
