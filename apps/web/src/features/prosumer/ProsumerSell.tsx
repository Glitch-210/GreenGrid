import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { useApiQuery, useApiMutation, apiErrorMessage } from "../../hooks/useApi";
import { formatINR } from "../../lib/format";
import type { EnergyCreditDTO, GridZoneDTO } from "@wattshare/shared";

/** A sellable credit carries the remainder the server will actually accept. */
type SellableCreditDTO = EnergyCreditDTO & { listableKwh: string };

interface ProsumerDashboardData {
  platformFeeRate: string;
}

/** Only used if the dashboard call hasn't landed yet; the server value wins. */
const FALLBACK_FEE_RATE = 0.05;

type FormMessage = { kind: "ok" | "error"; text: string };

export default function ProsumerSell() {
  const { data: credits } = useApiQuery<SellableCreditDTO[]>(
    ["credits", "sellable"],
    "/credits?sellable=true",
  );
  const { data: zones } = useApiQuery<GridZoneDTO[]>(["grid", "zones"], "/grid/zones");
  const { data: dashboard } = useApiQuery<ProsumerDashboardData>(["dashboard", "prosumer"], "/users/dashboard");

  const feeRate = dashboard ? Number(dashboard.platformFeeRate) : FALLBACK_FEE_RATE;

  const [creditId, setCreditId] = useState("");
  const [quantityKwh, setQuantityKwh] = useState("");
  // No magic default: the price is seeded from the selected batch's zone basePrice
  // below, so the form opens inside the band it advertises rather than at a
  // hardcoded 4.25 that belongs to no zone.
  const [pricePerKwh, setPricePerKwh] = useState("");
  // Once the seller types a price, stop re-seeding it from under them.
  const [priceTouched, setPriceTouched] = useState(false);
  // One string for both outcomes rendered them identically — a rejection and a
  // successful publish were the same near-black line. The kind drives both the
  // colour and the ARIA role.
  const [message, setMessage] = useState<FormMessage | null>(null);

  const publish = useApiMutation<{ creditId: string; quantityKwh: number; pricePerKwh: number }>(
    "post",
    "/marketplace/listings",
    // A new listing changes the credit's listable remainder AND the portfolio
    // balances behind the dashboard tiles and the header pill, so refresh all three.
    { invalidates: [["credits", "sellable"], ["dashboard", "prosumer"], ["marketplace", "listings"], ["listings", "mine"]] },
  );

  const selectedCredit = (credits ?? []).find((c) => c.id === creditId);
  const selectedZone = zones?.find((z) => z.id === selectedCredit?.gridZoneId);
  const zoneName = selectedZone?.name;
  // What the server will accept, not the raw balance — availableKwh still counts
  // quantity already committed to open listings.
  const maxKwh = selectedCredit ? Number(selectedCredit.listableKwh) : 0;

  const priceFloor = selectedZone ? Number(selectedZone.priceFloor) : null;
  const priceCeiling = selectedZone ? Number(selectedZone.priceCeiling) : null;

  // Seed (and re-seed, on a batch in a different zone) from the zone's basePrice
  // until the seller edits the field themselves.
  useEffect(() => {
    if (priceTouched || !selectedZone) return;
    setPricePerKwh(Number(selectedZone.basePrice).toFixed(2));
  }, [selectedZone, priceTouched]);

  /**
   * Client-side band check. The server still rejects PRICE_OUT_OF_BAND — this is
   * UX so the seller learns before a round-trip, not a substitute for that check.
   * Bounds are inclusive, matching marketplace.service.ts.
   */
  const priceError = useMemo(() => {
    if (!pricePerKwh.trim()) return null;
    const price = Number(pricePerKwh);
    if (!Number.isFinite(price) || price <= 0) return "Enter a price greater than zero.";
    if (priceFloor === null || priceCeiling === null) return null;
    const where = zoneName ? ` in ${zoneName}` : "";
    if (price < priceFloor) return `Below the floor of ₹${priceFloor.toFixed(2)}/kWh${where}.`;
    if (price > priceCeiling) return `Above the ceiling of ₹${priceCeiling.toFixed(2)}/kWh${where}.`;
    return null;
  }, [pricePerKwh, priceFloor, priceCeiling, zoneName]);

  /**
   * Client-side quantity check, against the listable remainder rather than raw
   * availableKwh — the browser treats `max` on a number input as a stepper hint
   * only, so typing past it was unimpeded. The server still rejects
   * INSUFFICIENT_CREDITS; this is UX.
   */
  const quantityError = useMemo(() => {
    if (!quantityKwh.trim()) return null;
    const qty = Number(quantityKwh);
    if (!Number.isFinite(qty) || qty <= 0) return "Enter a quantity greater than zero.";
    if (!selectedCredit) return null;
    if (qty > maxKwh) return `Only ${maxKwh.toFixed(2)} kWh is listable on this batch.`;
    return null;
  }, [quantityKwh, maxKwh, selectedCredit]);

  const { gross, fee, net } = useMemo(() => {
    const qty = Number(quantityKwh) || 0;
    const price = Number(pricePerKwh) || 0;
    const g = qty * price;
    const f = g * feeRate;
    return { gross: g, fee: f, net: g - f };
  }, [quantityKwh, pricePerKwh, feeRate]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    // Without this the form navigates away on Enter / submit-button click.
    e.preventDefault();
    // The button is disabled on a violation; this guards the other paths into
    // submit (Enter, programmatic) so the checks cannot be stepped around.
    const blocked = priceError ?? quantityError;
    if (blocked) {
      setMessage({ kind: "error", text: blocked });
      return;
    }
    setMessage(null);
    try {
      await publish.mutateAsync({
        creditId,
        quantityKwh: Number(quantityKwh),
        pricePerKwh: Number(pricePerKwh),
      });
      setMessage({ kind: "ok", text: "Listing broadcast to the P2P market." });
      setQuantityKwh("");
    } catch (err) {
      setMessage({ kind: "error", text: apiErrorMessage(err, "Failed to publish listing") });
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">SELL SURPLUS ENERGY</h1>
      <p className="mb-4 font-mono text-xs uppercase tracking-wider text-on-surface-variant">
        Publish a P2P listing from a verified credit batch
      </p>

      <Card className="max-w-xl">
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
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
                setPriceTouched(false);
              }}
            >
              <option value="">Select a verified credit batch</option>
              {(credits ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.creditId} — {Number(c.listableKwh).toFixed(2)} kWh available to list
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
                className={`w-full border-3 bg-white px-3 py-2 text-center font-mono text-sm ${
                  quantityError ? "border-fault" : "border-black"
                }`}
                type="number"
                min={0}
                max={maxKwh || undefined}
                step={0.1}
                value={quantityKwh}
                onChange={(e) => setQuantityKwh(e.target.value)}
                placeholder="0.0"
                aria-invalid={!!quantityError}
                aria-describedby="quantity-help"
              />
              <button
                type="button"
                className="border-3 border-black bg-white px-3 py-2 font-mono font-bold shadow-hard-sm active:translate-x-1 active:translate-y-1 active:shadow-none"
                onClick={() => setQuantityKwh(String(Math.min(maxKwh || Infinity, (Number(quantityKwh) || 0) + 0.5)))}
              >
                +
              </button>
            </div>
            <p
              id="quantity-help"
              className={`mt-1 font-mono text-[10px] uppercase ${
                quantityError ? "font-bold text-fault" : "text-on-surface-variant"
              }`}
            >
              {quantityError
                ? quantityError
                : selectedCredit
                  ? `Max available to list: ${maxKwh.toFixed(2)} kWh`
                  : "Select a credit batch to see its listable ceiling"}
            </p>
          </div>

          <div>
            <label className="mb-1 block font-mono text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
              Price per credit (₹/EC)
            </label>
            <input
              className={`w-full border-3 bg-white px-3 py-2 font-mono text-sm ${
                priceError ? "border-fault" : "border-black"
              }`}
              type="number"
              min={priceFloor ?? 0}
              max={priceCeiling ?? undefined}
              step={0.05}
              value={pricePerKwh}
              onChange={(e) => {
                setPriceTouched(true);
                setPricePerKwh(e.target.value);
              }}
              aria-invalid={!!priceError}
              aria-describedby="price-band-help"
            />
            <p
              id="price-band-help"
              className={`mt-1 font-mono text-[10px] uppercase ${
                priceError ? "font-bold text-fault" : "text-on-surface-variant"
              }`}
            >
              {priceError
                ? priceError
                : selectedZone
                  ? `Allowed range: ₹${priceFloor?.toFixed(2)}–₹${priceCeiling?.toFixed(2)}/kWh in ${zoneName}`
                  : "Select a credit batch to see its zone price band"}
            </p>
          </div>

          <div className="border-3 border-black bg-surface-container-low p-3">
            <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-wider">Settlement escrow ledger</p>
            <div className="flex justify-between font-mono text-xs">
              <span>Gross sale value</span>
              <span>{formatINR(gross)}</span>
            </div>
            <div className="flex justify-between font-mono text-xs text-fault">
              <span>Platform &amp; DISCOM fee ({+(feeRate * 100).toFixed(2)}%)</span>
              <span>−{formatINR(fee)}</span>
            </div>
            <div className="mt-1 flex justify-between border-t-2 border-black pt-1 font-mono text-sm font-bold">
              <span>Estimated net payout</span>
              <span>{formatINR(net)}</span>
            </div>
          </div>

          {/*
            The container is rendered unconditionally so it is a live region
            before any text lands in it — a region created at the same moment as
            its content is unreliably announced.
          */}
          <div
            className="min-h-[1.5rem]"
            role={message?.kind === "error" ? "alert" : "status"}
            aria-live={message?.kind === "error" ? "assertive" : "polite"}
            aria-atomic="true"
          >
            {message && (
              <p
                className={`font-mono text-sm ${
                  message.kind === "error" ? "font-bold text-fault" : "text-solar-dark"
                }`}
              >
                {/* Glyph so the outcome is not carried by colour alone; the
                    role already conveys severity to AT, so hide it there. */}
                <span aria-hidden>{message.kind === "error" ? "✕" : "✓"}</span> {message.text}
              </p>
            )}
          </div>

          <Button
            variant="solar"
            type="submit"
            disabled={
              publish.isPending || !creditId || !quantityKwh || !pricePerKwh || !!priceError || !!quantityError
            }
          >
            Publish P2P listing
          </Button>
        </form>
      </Card>
    </div>
  );
}
