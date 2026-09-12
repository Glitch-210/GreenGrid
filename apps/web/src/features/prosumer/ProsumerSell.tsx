import { useState } from "react";
import { PageShell } from "../../components/ui/PageShell";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { useApiQuery } from "../../hooks/useApi";
import { api } from "../../lib/api";
import type { EnergyCreditDTO } from "@wattshare/shared";

export default function ProsumerSell() {
  const { data: credits, refetch } = useApiQuery<EnergyCreditDTO[]>(["credits", "available"], "/credits?status=AVAILABLE");
  const [creditId, setCreditId] = useState("");
  const [quantityKwh, setQuantityKwh] = useState("");
  const [pricePerKwh, setPricePerKwh] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    setMessage(null);
    try {
      await api.post("/marketplace/listings", { creditId, quantityKwh: Number(quantityKwh), pricePerKwh: Number(pricePerKwh) });
      setMessage("Listing created.");
      refetch();
    } catch (err: any) {
      setMessage(err?.response?.data?.message ?? "Failed to list");
    }
  }

  return (
    <PageShell title="List energy credits for sale">
      <Card className="max-w-md">
        <div className="flex flex-col gap-3">
          <select className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2" value={creditId} onChange={(e) => setCreditId(e.target.value)}>
            <option value="">Select a credit batch</option>
            {(credits ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.creditId} — {c.availableKwh} kWh available
              </option>
            ))}
          </select>
          <input className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2" placeholder="quantity (kWh)" value={quantityKwh} onChange={(e) => setQuantityKwh(e.target.value)} />
          <input className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2" placeholder="price per kWh (₹2.50–₹7.00 band)" value={pricePerKwh} onChange={(e) => setPricePerKwh(e.target.value)} />
          {message && <p className="text-sm text-amber-400">{message}</p>}
          <Button onClick={submit}>List for sale</Button>
        </div>
      </Card>
    </PageShell>
  );
}
