import type { ReactNode } from "react";

const STATUS_STYLES = {
  live: "bg-solar text-black",
  idle: "bg-alert text-black",
  fault: "bg-fault text-white",
  "off-grid": "bg-surface-container text-black",
} as const;

export type StatusBadgeStatus = keyof typeof STATUS_STYLES;

export function StatusBadge({
  status,
  children,
  className = "",
}: {
  status: StatusBadgeStatus;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 border-2 border-black px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider shadow-hard-sm ${STATUS_STYLES[status]} ${className}`}
    >
      {children}
    </span>
  );
}
