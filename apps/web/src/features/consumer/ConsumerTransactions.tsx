import { Link } from "react-router-dom";
import { Card } from "../../components/ui/Card";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { useApiQuery } from "../../hooks/useApi";
import { formatINR, formatKwh } from "../../lib/format";
import type { TransactionDTO } from "@wattshare/shared";

const TERMINAL_STATUSES = new Set(["COMPLETED", "SETTLED"]);
const FAILURE_STATUSES = new Set(["PAYMENT_FAILED", "BLOCKCHAIN_FAILED", "SETTLEMENT_FAILED", "CANCELLED", "EXPIRED"]);

export default function ConsumerTransactions() {
  const { data } = useApiQuery<TransactionDTO[]>(["transactions", "mine"], "/transactions");

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold tracking-tight">MY TRANSACTIONS</h1>
      <p className="mb-4 font-mono text-xs uppercase tracking-wider text-on-surface-variant">
        Purchase history &amp; settlement status
      </p>
      <div className="grid gap-3">
        {(data ?? []).map((tx) => (
          <Link key={tx.id} to={`/transactions/${tx.id}`}>
            <Card className="flex items-center justify-between">
              <div>
                <p className="font-mono text-sm font-bold">{tx.transactionId}</p>
                <p className="text-xs text-on-surface-variant">{formatKwh(tx.quantityKwh)}</p>
              </div>
              <div className="text-right">
                <p className="font-mono font-bold">{formatINR(tx.totalAmount)}</p>
                <StatusBadge status={FAILURE_STATUSES.has(tx.status) ? "fault" : TERMINAL_STATUSES.has(tx.status) ? "live" : "idle"}>
                  {tx.status}
                </StatusBadge>
              </div>
            </Card>
          </Link>
        ))}
        {data?.length === 0 && <p className="text-on-surface-variant">No transactions yet — visit the marketplace to buy energy credits.</p>}
      </div>
    </div>
  );
}
