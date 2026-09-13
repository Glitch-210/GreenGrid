import type { ButtonHTMLAttributes } from "react";

const VARIANTS = {
  solar: "bg-solar text-black",
  grid: "bg-grid text-white",
  neutral: "bg-white text-black",
  fault: "bg-fault text-white",
} as const;

export type ButtonVariant = keyof typeof VARIANTS;

export function Button({
  className = "",
  variant = "solar",
  // A bare <button> inside a <form> defaults to type="submit", so any Button
  // placed in a form would submit it by accident. Default to "button"; callers
  // that mean to submit pass type="submit" explicitly.
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type={type}
      className={`border-3 border-black px-4 py-2 font-mono text-sm font-bold uppercase tracking-wide shadow-hard transition-all duration-100 hover:-translate-x-px hover:-translate-y-px hover:shadow-hard-lg active:translate-x-1 active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-hard ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}

export const NeoButton = Button;
