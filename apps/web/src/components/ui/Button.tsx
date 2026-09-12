import type { ButtonHTMLAttributes } from "react";

export function Button({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`rounded-md bg-energy-green px-4 py-2 font-medium text-neutral-950 transition hover:brightness-110 disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}
