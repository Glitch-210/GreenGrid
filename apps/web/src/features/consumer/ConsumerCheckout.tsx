import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
      navigate(`/transactions/${res.data.data.id}`);
    } catch (err: any) {
      if (err?.response?.data?.errorCode === "GRID_CONGESTED") {
        setError(`Grid congested — only ${err.response.data.message}`);
      } else {
        setError(err?.response?.data?.message ?? "Failed to create transaction");
      }
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">AUTO-MATCH REQUIREMENT</h1>
      <p className="mb-4 font-mono text-xs uppercase tracking-wider text-on-surface-variant">
        Find the best blended price across active sellers
      </p>
      <Card className="max-w-xl">
        <div className="flex flex-wrap gap-3">
          <input
            className="flex-1 border-3 border-black bg-white px-3 py-2 font-mono text-sm"
            placeholder="quantity (kWh)"
            value={quantityKwh}
            onChange={(e) => setQuantityKwh(e.target.value)}
          />
          <input
            className="flex-1 border-3 border-black bg-white px-3 py-2 font-mono text-sm"
            placeholder="grid zone id"
            value={gridZoneId}
            onChange={(e) => setGridZoneId(e.target.value)}
          />
          <Button variant="grid" onClick={findMatches}>
            Find matches
          </Button>
        </div>

        {error && <p className="mt-3 font-mono text-sm text-fault">{error}</p>}

        {preview && (
          <div className="mt-4">
            <table className="w-full font-mono text-sm">
              <thead className="text-on-surface-variant">
                <tr className="border-b-2 border-black">
                  <th className="text-left">Seller</th>
                  <th className="text-right">kWh</th>
                  <th className="text-right">₹/kWh</th>
                </tr>
              </thead>
              <tbody>
                {preview.allocations.map((a) => (
                  <tr key={a.listingId} className="border-b border-outline">
                    <td>{a.sellerAlias}</td>
                    <td className="text-right">{a.kwh}</td>
                    <td className="text-right">{a.price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 font-mono text-xs text-on-surface-variant">
              Weighted avg price: ₹{preview.weightedAvgPrice} · Filled {preview.filledKwh} kWh
              {Number(preview.unfilledKwh) > 0 && ` · ${preview.unfilledKwh} kWh from normal grid supply`}
            </p>
            <Button variant="solar" className="mt-3" onClick={confirm}>
              Confirm purchase
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
