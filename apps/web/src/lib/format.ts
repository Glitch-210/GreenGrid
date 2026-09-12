export function formatINR(value: string | number): string {
  const n = typeof value === "string" ? Number(value) : value;
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatKwh(value: string | number): string {
  const n = typeof value === "string" ? Number(value) : value;
  return `${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWh`;
}

export function formatEC(value: string | number): string {
  const n = typeof value === "string" ? Number(value) : value;
  return `${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })} EC`;
}
