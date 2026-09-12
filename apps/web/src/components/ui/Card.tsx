import type { HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`rounded-lg border border-neutral-800 bg-neutral-900 p-4 ${className}`} {...props} />;
}
