import type { HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`border-3 border-black bg-white p-4 shadow-hard ${className}`}
      {...props}
    />
  );
}
