function pad(n: number, width: number) {
  return String(n).padStart(width, "0");
}

function yyyymmdd(date: Date) {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1, 2)}${pad(date.getUTCDate(), 2)}`;
}

let creditSeq = 0;
let txnSeq = 0;
let settleSeq = 0;

// A process-local counter alone collides across process restarts/instances (e.g. the
// seed script and the API server, or two API instances, each start counting from 0 on
// the same calendar day and can independently mint the same "TXN-<date>-0001"). This
// per-process random suffix — fixed for the lifetime of the process — makes IDs from
// different processes distinguishable while keeping the human-readable date+seq shape.
const processSuffix = Math.random().toString(36).slice(2, 6).toUpperCase();

export function nextCreditId(zoneCode: string, date = new Date()) {
  creditSeq += 1;
  const shortZone = zoneCode.replace(/[^A-Z0-9]/gi, "").slice(0, 5).toUpperCase();
  return `EC-${shortZone}-${yyyymmdd(date)}-${processSuffix}-${pad(creditSeq, 4)}`;
}

export function nextTransactionId(date = new Date()) {
  txnSeq += 1;
  return `TXN-${yyyymmdd(date)}-${processSuffix}-${pad(txnSeq, 4)}`;
}

export function nextSettlementRef() {
  settleSeq += 1;
  return `SET-${processSuffix}-${pad(settleSeq, 6)}`;
}
