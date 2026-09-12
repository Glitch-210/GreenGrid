import { Link } from "react-router-dom";
import { Card } from "../../components/ui/Card";
import { MetricTile } from "../../components/ui/MetricTile";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { useApiQuery } from "../../hooks/useApi";
import { useAuth } from "../../hooks/useAuth";
import { formatEC, formatINR } from "../../lib/format";
import type { TransactionDTO } from "@wattshare/shared";

const SETTLED_STATUSES = new Set(["COMPLETED", "SETTLED"]);
const FAILURE_STATUSES = new Set(["PAYMENT_FAILED", "BLOCKCHAIN_FAILED", "SETTLEMENT_FAILED", "CANCELLED", "EXPIRED"]);

interface ProsumerDashboardData {
  totalEarnings: string;
  platformFeeRate: string;
}

export default function ProsumerTransactions() {
  const { user } = useAuth();
  const { data, isLoading, isError } = useApiQuery<TransactionDTO[]>(["transactions", "mine"], "/transactions");
  const { data: dashboard } = useApiQuery<ProsumerDashboardData>(["dashboard", "prosumer"], "/users/dashboard");

  const rows = data ?? [];
  // GET /transactions returns anything the caller is party to. On this screen the
  // seller side is what matters, so purchases they made as a buyer are filtered out.
  const sales = rows.filter((t) => t.buyerId !== user?.id);
  const feeRate = dashboard ? Number(dashboard.platformFeeRate) : null;

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">MY SALES</h1>
      <p className="mb-4 font-mono text-xs uppercase tracking-wider text-on-surface-variant">
        Energy sold, fees deducted &amp; settlement status
      </p>

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricTile
          label="Total Earned"
          value={dashboard ? formatINR(dashboard.totalEarnings) : "—"}
          delta="Net of platform fee"
        />
        <MetricTile label="Sales" value={String(sales.length)} delta="Trades as seller" />
        <MetricTile
          label="Fee Rate"
          value={feeRate === null ? "—" : `${+(feeRate * 100).toFixed(2)}%`}
          delta="Platform & DISCOM"
        />
      </div>

      {isLoading && <p className="font-mono text-sm text-on-surface-variant">Loading your sales…</p>}
      {isError && (
        <p role="alert" className="font-mono text-sm text-fault">
          Could not load your sales. Refresh to try again.
        </p>
      )}

      {!isLoading && !isError && (
        <div className="grid gap-3">
          {sales.map((tx) => {
            // A multi-seller basket has no single sellerPayout for this seller, so
            // the per-trade payout is only shown when the trade was wholly theirs.
            const wholly = tx.sellerId === user?.id;
            // A cancelled or failed trade earned nothing, so don't print a payout
            // beside it as though it did — only the quantity that was in play.
            const failed = FAILURE_STATUSES.has(tx.status);
            return (
              <Link key={tx.id} to={`/transactions/${tx.id}`}>
                <Card className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-mono text-sm font-bold">{tx.transactionId}</p>
                    <p className="font-mono text-xs text-on-surface-variant">
                      {formatEC(tx.quantityKwh)} @ {formatINR(tx.pricePerKwh)} / EC
                      {!wholly && " · shared basket"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-mono font-bold ${failed ? "text-on-surface-variant line-through" : ""}`}>
                      {wholly ? formatINR(tx.sellerPayout) : formatINR(tx.totalAmount)}
                    </p>
                    <p className="font-mono text-[10px] uppercase text-on-surface-variant">
                      {failed ? "not earned" : wholly ? `net after ${formatINR(tx.platformFee)} fee` : "basket total"}
                    </p>
                    <StatusBadge
                      className="mt-1"
                      status={failed ? "fault" : SETTLED_STATUSES.has(tx.status) ? "live" : "idle"}
                    >
                      {tx.status}
                    </StatusBadge>
                  </div>
                </Card>
              </Link>
            );
          })}

          {sales.length === 0 && (
            <p className="text-on-surface-variant">
              No sales yet — list some surplus on the marketplace and buyers will find you.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
