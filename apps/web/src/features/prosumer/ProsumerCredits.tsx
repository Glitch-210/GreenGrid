import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { TxHash } from "../../components/ui/TxHash";
import { useApiQuery } from "../../hooks/useApi";
import type { EnergyCreditDTO } from "@wattshare/shared";

/** `?sellable=true` adds the remainder the server will actually accept. */
type CreditRow = EnergyCreditDTO & { listableKwh?: string };

type Filter = "all" | "sellable" | "expired";
type Sort = "newest" | "expiring" | "largest";

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "all", label: "All" },
  { key: "sellable", label: "Sellable" },
  { key: "expired", label: "Expired" },
];

const SORTS: Array<{ key: Sort; label: string }> = [
  { key: "newest", label: "Newest" },
  { key: "expiring", label: "Expiring soon" },
  { key: "largest", label: "Largest" },
];

const DEAD_STATUSES = ["FROZEN", "EXPIRED", "RETIRED", "SETTLED"];

function isExpired(c: CreditRow) {
  return new Date(c.expiresAt).getTime() <= Date.now();
}

export default function ProsumerCredits() {
  const { data, isLoading, isError, refetch } = useApiQuery<CreditRow[]>(["credits", "mine"], "/credits");
  /**
   * Sellability is a quantity question, not a status one, and only the server
   * can answer it — availableKwh does not drop when a batch is listed, so it
   * cannot be read off the row. This is the same query (and cache entry) the
   * Sell page uses, so the badge here and the dropdown there cannot disagree.
   */
  const { data: sellable } = useApiQuery<CreditRow[]>(["credits", "sellable"], "/credits?sellable=true");

  const listableById = useMemo(
    () => new Map((sellable ?? []).map((c) => [c.id, Number(c.listableKwh ?? c.availableKwh)])),
    [sellable],
  );

  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("newest");

  const rows = useMemo(() => {
    const all = data ?? [];
    const filtered = all.filter((c) => {
      if (filter === "sellable") return (listableById.get(c.id) ?? 0) > 0;
      if (filter === "expired") return isExpired(c) || DEAD_STATUSES.includes(c.status);
      return true;
    });
    const sorted = [...filtered];
    if (sort === "newest") {
      sorted.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
    } else if (sort === "expiring") {
      sorted.sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime());
    } else {
      sorted.sort((a, b) => Number(b.availableKwh) - Number(a.availableKwh));
    }
    return sorted;
  }, [data, filter, sort, listableById]);

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">MY ENERGY CREDITS</h1>
      <p className="mb-4 font-mono text-xs uppercase tracking-wider text-on-surface-variant">
        Verified credit batches minted from smart meter surplus
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex" role="group" aria-label="Filter credit batches">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={`border-3 border-black px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider shadow-hard-sm -ml-[3px] first:ml-0 ${
                filter === f.key ? "bg-solar text-black" : "bg-white text-on-surface-variant"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <label className="ml-auto flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
          Sort
          <select
            className="border-3 border-black bg-white px-2 py-1 font-mono text-xs"
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-3">
        {/* Three distinct states. Previously only the empty one was handled, so a
            failed fetch was indistinguishable from an account with no credits. */}
        {isLoading && (
          <p role="status" className="font-mono text-sm text-on-surface-variant">
            Loading credit batches…
          </p>
        )}

        {isError && (
          <Card className="flex flex-wrap items-center justify-between gap-3">
            <p role="alert" className="font-mono text-sm font-bold text-fault">
              ✕ Could not load your credit batches.
            </p>
            <Button variant="neutral" onClick={() => refetch()}>
              Retry
            </Button>
          </Card>
        )}

        {!isLoading &&
          !isError &&
          rows.map((c) => {
            const listable = listableById.get(c.id) ?? 0;
            return (
              <Card key={c.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-sm font-bold">{c.creditId}</p>
                  <p className="font-mono text-xs text-on-surface-variant">
                    expires {new Date(c.expiresAt).toLocaleString()}
                  </p>
                  {c.blockchainTxHash && <TxHash hash={c.blockchainTxHash} className="mt-1 inline-block" />}
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <StatusBadge status={listable > 0 ? "live" : isExpired(c) ? "fault" : "idle"}>
                      {listable > 0 ? "Sellable" : isExpired(c) ? "Expired" : c.status}
                    </StatusBadge>
                    <p className="mt-1 font-mono text-xs text-on-surface-variant">avail {c.availableKwh} kWh</p>
                  </div>
                  {listable > 0 && (
                    <Link to={`/prosumer/sell?creditId=${encodeURIComponent(c.id)}`}>
                      <Button variant="solar">Sell this batch</Button>
                    </Link>
                  )}
                </div>
              </Card>
            );
          })}

        {!isLoading && !isError && rows.length === 0 && (
          <p className="text-on-surface-variant">
            {(data ?? []).length === 0
              ? "No credits yet — surplus solar generation mints credits automatically."
              : `No batches match the "${FILTERS.find((f) => f.key === filter)?.label}" filter.`}
          </p>
        )}
      </div>
    </div>
  );
}
