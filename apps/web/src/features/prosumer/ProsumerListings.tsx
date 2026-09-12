import { useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { useApiQuery, useApiMutation, apiErrorMessage } from "../../hooks/useApi";
import { formatINR } from "../../lib/format";
import type { MarketplaceListingDTO } from "@wattshare/shared";

/** Only these can be withdrawn — mirrors the guard in marketplace.service.ts. */
const CANCELLABLE = new Set(["ACTIVE", "PARTIAL"]);

function statusTone(status: string) {
  if (status === "SOLD") return "live" as const;
  if (status === "CANCELLED" || status === "EXPIRED") return "fault" as const;
  return "idle" as const;
}

export default function ProsumerListings() {
  const { data, isLoading, isError } = useApiQuery<MarketplaceListingDTO[]>(
    ["listings", "mine"],
    "/marketplace/listings?mine=true&sort=newest",
  );

  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cancel = useApiMutation<{ id: string }>("delete", (body) => `/marketplace/listings/${body.id}`, {
    // Withdrawing a listing frees the credit's quantity back up, so the Sell page's
    // listable remainder and the dashboard tiles both change.
    invalidates: [["listings", "mine"], ["credits", "sellable"], ["dashboard", "prosumer"], ["marketplace", "listings"]],
  });

  async function confirmCancel(id: string) {
    setError(null);
    try {
      await cancel.mutateAsync({ id });
      setConfirmingId(null);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not withdraw the listing"));
    }
  }

  const listings = data ?? [];
  const active = listings.filter((l) => CANCELLABLE.has(l.status));

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">MY LISTINGS</h1>
      <p className="mb-4 font-mono text-xs uppercase tracking-wider text-on-surface-variant">
        {active.length} live on the market · {listings.length} total
      </p>

      {error && (
        <p role="alert" className="mb-4 font-mono text-sm text-fault">
          {error}
        </p>
      )}

      {isLoading && <p className="font-mono text-sm text-on-surface-variant">Loading your listings…</p>}
      {isError && (
        <p role="alert" className="font-mono text-sm text-fault">
          Could not load your listings. Refresh to try again.
        </p>
      )}

      {!isLoading && !isError && (
        <div className="grid gap-3">
          {listings.map((l) => {
            const sold = Number(l.quantityKwh) - Number(l.remainingKwh);
            return (
              <Card key={l.id} className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-display text-lg font-bold">
                      {Number(l.remainingKwh).toFixed(2)} EC left
                      <span className="font-mono text-xs font-normal text-on-surface-variant">
                        {" "}
                        of {Number(l.quantityKwh).toFixed(2)}
                      </span>
                    </p>
                    <p className="font-mono text-xs uppercase text-on-surface-variant">
                      {l.zoneName} · {formatINR(l.pricePerKwh)} / EC
                    </p>
                  </div>
                  <StatusBadge status={statusTone(l.status)}>{l.status}</StatusBadge>
                </div>

                <div className="flex items-baseline justify-between border-t-2 border-black pt-2 font-mono text-xs">
                  <span className="uppercase text-on-surface-variant">Sold so far</span>
                  <span className="font-bold">
                    {sold.toFixed(2)} EC · {formatINR(sold * Number(l.pricePerKwh))}
                  </span>
                </div>
                <div className="flex items-baseline justify-between font-mono text-xs">
                  <span className="uppercase text-on-surface-variant">Still on offer</span>
                  <span className="font-bold">{formatINR(Number(l.remainingKwh) * Number(l.pricePerKwh))}</span>
                </div>

                {CANCELLABLE.has(l.status) &&
                  (confirmingId === l.id ? (
                    <div className="mt-2 border-3 border-black bg-surface-container-low p-3">
                      <p className="mb-2 font-mono text-xs">
                        Withdraw {Number(l.remainingKwh).toFixed(2)} EC from the market? Buyers can no longer
                        purchase it, and the credits return to your sellable balance.
                      </p>
                      <div className="flex gap-2">
                        <Button variant="fault" disabled={cancel.isPending} onClick={() => confirmCancel(l.id)}>
                          {cancel.isPending ? "Withdrawing…" : "Yes, withdraw"}
                        </Button>
                        <Button variant="neutral" disabled={cancel.isPending} onClick={() => setConfirmingId(null)}>
                          Keep it listed
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button variant="neutral" className="mt-2" onClick={() => setConfirmingId(l.id)}>
                      Withdraw listing
                    </Button>
                  ))}
              </Card>
            );
          })}

          {listings.length === 0 && (
            <Card className="flex flex-col items-start gap-3">
              <p className="text-on-surface-variant">
                You have no listings yet. Publish one from a verified credit batch to start selling.
              </p>
              <Link to="/prosumer/sell">
                <Button variant="solar">Sell surplus energy</Button>
              </Link>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
