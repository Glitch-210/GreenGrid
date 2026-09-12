import { useState } from "react";
import { useParams } from "react-router-dom";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { TxHash } from "../../components/ui/TxHash";
import { useApiQuery } from "../../hooks/useApi";
import { useAuth } from "../../hooks/useAuth";
import { useSocketInvalidate } from "../../hooks/useSocket";
import { api } from "../../lib/api";
import { formatINR, formatKwh } from "../../lib/format";
import { Role } from "@wattshare/shared";
import type { GridZoneDTO, TransactionDTO } from "@wattshare/shared";

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

const FAILURE_STATUSES = new Set(["PAYMENT_FAILED", "BLOCKCHAIN_FAILED", "SETTLEMENT_FAILED", "CANCELLED", "EXPIRED"]);

export default function SettlementDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data, refetch } = useApiQuery<TransactionDTO>(["transaction", id], `/transactions/${id}`);
  const { data: zones } = useApiQuery<GridZoneDTO[]>(["grid", "zones"], "/grid/zones", user?.role === Role.ADMIN);
  useSocketInvalidate("payment:updated", ["transaction", id]);
  useSocketInvalidate("settlement:updated", ["transaction", id]);

  const [demoBusy, setDemoBusy] = useState<string | null>(null);

  const currentIndex = data ? STEPS.indexOf(data.status) : -1;
  const failed = data ? FAILURE_STATUSES.has(data.status) : false;

  async function runDemo(action: string, req: () => Promise<unknown>) {
    setDemoBusy(action);
    try {
      await req();
      refetch();
    } finally {
      setDemoBusy(null);
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">DISCOM BILL SETTLEMENT</h1>
      <p className="mb-4 font-mono text-xs uppercase tracking-wider text-on-surface-variant">
        Regulatory-compliant P2P trade receipt
      </p>

      {!data ? (
        <p className="text-on-surface-variant">Loading settlement receipt…</p>
      ) : (
        <>
          <Card className="mb-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b-3 border-black pb-3">
              <p className="font-mono text-sm font-bold">{data.transactionId}</p>
              <StatusBadge status={failed ? "fault" : currentIndex >= STEPS.length - 1 ? "live" : "idle"}>
                {data.status.replace(/_/g, " ")}
              </StatusBadge>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="font-mono text-[10px] uppercase text-on-surface-variant">Credits settled</p>
                <p className="font-display text-xl font-extrabold">{formatKwh(data.quantityKwh)}</p>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase text-on-surface-variant">Total amount</p>
                <p className="font-display text-xl font-extrabold">{formatINR(data.totalAmount)}</p>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase text-on-surface-variant">Platform fee</p>
                <p className="font-display text-xl font-extrabold">{formatINR(data.platformFee)}</p>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase text-on-surface-variant">Seller payout</p>
                <p className="font-display text-xl font-extrabold">{formatINR(data.sellerPayout)}</p>
              </div>
            </div>
            {data.blockchainTxHash && (
              <p className="mt-3 flex flex-wrap items-center gap-2 border-t-2 border-black pt-2 font-mono text-xs text-on-surface-variant">
                Metrology proof: <TxHash hash={data.blockchainTxHash} />
              </p>
            )}
          </Card>

          <Card className="mb-4">
            <p className="mb-3 font-mono text-xs font-bold uppercase tracking-wider">Settlement lifecycle</p>
            <div className="flex flex-wrap gap-2">
              {STEPS.map((step, i) => (
                <span
                  key={step}
                  className={`border-2 border-black px-2 py-1 font-mono text-[10px] font-bold uppercase ${
                    i <= currentIndex && !failed ? "bg-solar text-black" : "bg-white text-on-surface-variant"
                  }`}
                >
                  {step.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </Card>

          {user?.role === Role.ADMIN && (
            <Card className="border-black bg-[#1b1b1b] text-white">
              <p className="mb-3 font-mono text-xs font-bold uppercase tracking-wider">Demo simulator controls</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="grid"
                  disabled={!!demoBusy}
                  onClick={() => runDemo("reconcile", () => api.post("/demo/discom", { mode: "ok" }))}
                >
                  Trigger batch reconciliation
                </Button>
                <Button
                  variant="fault"
                  disabled={!!demoBusy}
                  onClick={() =>
                    runDemo("fault", () =>
                      api.post("/demo/congest", {
                        zoneCode: zones?.find((z) => z.id === data.gridZoneId)?.zoneCode ?? data.gridZoneId,
                        congested: true,
                      }),
                    )
                  }
                >
                  Inject demo grid fault
                </Button>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
