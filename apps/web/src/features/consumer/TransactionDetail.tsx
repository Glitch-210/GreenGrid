import { useParams } from "react-router-dom";
import { PageShell } from "../../components/ui/PageShell";
import { Card } from "../../components/ui/Card";
import { useApiQuery } from "../../hooks/useApi";
import { useSocketInvalidate } from "../../hooks/useSocket";
import type { TransactionDTO } from "@wattshare/shared";

const STEPS = [
  "PENDING",
  "MATCHED",
  "RESERVED",
  "PAYMENT_PENDING",
  "PAID",
  "CREDIT_TRANSFERRED",
  "SETTLEMENT_PENDING",
  "SETTLED",
  "COMPLETED",
];

export default function TransactionDetail() {
  const { id } = useParams();
  const { data, refetch } = useApiQuery<TransactionDTO>(["transaction", id], `/transactions/${id}`);
  useSocketInvalidate("payment:updated", ["transaction", id]);
  useSocketInvalidate("settlement:updated", ["transaction", id]);

  const currentIndex = data ? STEPS.indexOf(data.status) : -1;

  return (
    <PageShell title="Transaction status">
      <Card>
        <div className="flex flex-wrap gap-2">
          {STEPS.map((step, i) => (
            <span
              key={step}
              className={`rounded-full px-3 py-1 text-xs ${i <= currentIndex ? "bg-energy-green text-neutral-950" : "bg-neutral-800 text-neutral-400"}`}
            >
              {step}
            </span>
          ))}
        </div>
        {data && (
          <div className="mt-4 text-sm text-neutral-300">
            <p>Transaction: {data.transactionId}</p>
            <p>Quantity: {data.quantityKwh} kWh</p>
            <p>Total: ₹{data.totalAmount}</p>
            {data.blockchainTxHash && <p className="font-mono text-xs text-neutral-500">tx: {data.blockchainTxHash}</p>}
          </div>
        )}
        <button className="mt-4 text-xs text-neutral-500 underline" onClick={() => refetch()}>
          refresh
        </button>
      </Card>
    </PageShell>
  );
}
