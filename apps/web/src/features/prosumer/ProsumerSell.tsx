import { useMemo, useState } from "react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { useApiQuery } from "../../hooks/useApi";
import { api } from "../../lib/api";
import { formatINR } from "../../lib/format";
import type { EnergyCreditDTO, GridZoneDTO } from "@wattshare/shared";

export default function ProsumerSell() {
  const { data: credits, refetch } = useApiQuery<EnergyCreditDTO[]>(["credits", "available"], "/credits?status=AVAILABLE");
  const { data: zones } = useApiQuery<GridZoneDTO[]>(["grid", "zones"], "/grid/zones");

  const [creditId, setCreditId] = useState("");
  const [quantityKwh, setQuantityKwh] = useState("");
  const [pricePerKwh, setPricePerKwh] = useState("4.25");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selectedCredit = (credits ?? []).find((c) => c.id === creditId);
  const zoneName = zones?.find((z) => z.id === selectedCredit?.gridZoneId)?.name;
  const maxKwh = selectedCredit ? Number(selectedCredit.availableKwh) : 0;

  const { gross, fee, net } = useMemo(() => {
    const qty = Number(quantityKwh) || 0;
    const price = Number(pricePerKwh) || 0;
    const g = qty * price;
    const f = g * 0.05;
    return { gross: g, fee: f, net: g - f };
  }, [quantityKwh, pricePerKwh]);

  async function submit() {
    setMessage(null);
    setBusy(true);
    try {
      await api.post("/marketplace/listings", {
        creditId,
        quantityKwh: Number(quantityKwh),
        pricePerKwh: Number(pricePerKwh),
      });
      setMessage("Listing broadcast to the P2P market.");
      setQuantityKwh("");
      refetch();
    } catch (err: any) {
      setMessage(err?.response?.data?.message ?? "Failed to publish listing");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">SELL SURPLUS ENERGY</h1>
      <p className="mb-4 font-mono text-xs uppercase tracking-wider text-on-surface-variant">
        Publish a P2P listing from a verified credit batch
      </p>

      <Card className="max-w-xl">
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block font-mono text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
              Credit batch
            </label>
            <select
              className="w-full border-3 border-black bg-white px-3 py-2 font-mono text-sm"
              value={creditId}
              onChange={(e) => {
                setCreditId(e.target.value);
                setQuantityKwh("");
              }}
            >
              <option value="">Select a verified credit batch</option>
              {(credits ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.creditId} — {c.availableKwh} kWh available
                </option>
              ))}
            </select>
          </div>

          {selectedCredit && (
            <div className="flex items-center justify-between border-3 border-black bg-surface-container-low px-3 py-2">
              <span className="font-mono text-xs">{zoneName ?? "Grid zone"}</span>
              <StatusBadge status="live">Meter verified</StatusBadge>
            </div>
          )}

          <div>
            <label className="mb-1 block font-mono text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
              Quantity to sell (EC)
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="border-3 border-black bg-white px-3 py-2 font-mono font-bold shadow-hard-sm active:translate-x-1 active:translate-y-1 active:shadow-none"
                onClick={() => setQuantityKwh(String(Math.max(0, (Number(quantityKwh) || 0) - 0.5)))}
              >
                −
              </button>
              <input
                className="w-full border-3 border-black bg-white px-3 py-2 text-center font-mono text-sm"
                type="number"
                min={0}
                max={maxKwh || undefined}
                step={0.1}
                value={quantityKwh}
                onChange={(e) => setQuantityKwh(e.target.value)}
                placeholder="0.0"
              />
              <button
                type="button"
                className="border-3 border-black bg-white px-3 py-2 font-mono font-bold shadow-hard-sm active:translate-x-1 active:translate-y-1 active:shadow-none"
                onClick={() => setQuantityKwh(String(Math.min(maxKwh || Infinity, (Number(quantityKwh) || 0) + 0.5)))}
              >
                +
              </button>
            </div>
            {selectedCredit && (
              <p className="mt-1 font-mono text-[10px] uppercase text-on-surface-variant">Max available: {maxKwh} kWh</p>
            )}
          </div>

          <div>
            <label className="mb-1 block font-mono text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
              Price per credit (₹/EC)
            </label>
            <input
              className="w-full border-3 border-black bg-white px-3 py-2 font-mono text-sm"
              type="number"
              min={0}
              step={0.05}
              value={pricePerKwh}
              onChange={(e) => setPricePerKwh(e.target.value)}
            />
          </div>

          <div className="border-3 border-black bg-surface-container-low p-3">
            <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-wider">Settlement escrow ledger</p>
            <div className="flex justify-between font-mono text-xs">
              <span>Gross sale value</span>
              <span>{formatINR(gross)}</span>
            </div>
            <div className="flex justify-between font-mono text-xs text-fault">
              <span>Platform &amp; DISCOM fee (5%)</span>
              <span>−{formatINR(fee)}</span>
            </div>
            <div className="mt-1 flex justify-between border-t-2 border-black pt-1 font-mono text-sm font-bold">
              <span>Estimated net payout</span>
              <span>{formatINR(net)}</span>
            </div>
          </div>

          {message && <p className="font-mono text-sm">{message}</p>}

          <Button
            variant="solar"
            disabled={busy || !creditId || !quantityKwh || !pricePerKwh}
            onClick={submit}
          >
            Publish P2P listing
          </Button>
        </div>
      </Card>
    </div>
  );
}
