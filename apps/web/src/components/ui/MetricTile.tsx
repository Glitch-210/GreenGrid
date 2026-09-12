import type { ReactNode } from "react";
import { Card } from "./Card";

export function MetricTile({
  label,
  value,
  delta,
  className = "",
}: {
  label: string;
  value: ReactNode;
  delta?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{label}</p>
      <p className="mt-1 font-display text-3xl font-extrabold tracking-tight text-on-surface">{value}</p>
      {delta && (
        <p className="mt-2 border-t-2 border-black pt-1 font-mono text-[11px] font-bold uppercase text-on-surface-variant">
          {delta}
        </p>
      )}
    </Card>
  );
}
