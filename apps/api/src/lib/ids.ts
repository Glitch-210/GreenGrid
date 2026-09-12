function pad(n: number, width: number) {
  return String(n).padStart(width, "0");
}

function yyyymmdd(date: Date) {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1, 2)}${pad(date.getUTCDate(), 2)}`;
}

let creditSeq = 0;
let txnSeq = 0;
let settleSeq = 0;

export function nextCreditId(zoneCode: string, date = new Date()) {
  creditSeq += 1;
  const shortZone = zoneCode.replace(/[^A-Z0-9]/gi, "").slice(0, 5).toUpperCase();
  return `EC-${shortZone}-${yyyymmdd(date)}-${pad(creditSeq, 4)}`;
}

export function nextTransactionId(date = new Date()) {
  txnSeq += 1;
  return `TXN-${yyyymmdd(date)}-${pad(txnSeq, 4)}`;
}

export function nextSettlementRef() {
  settleSeq += 1;
  return `SET-${pad(settleSeq, 6)}`;
}
