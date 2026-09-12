const FILL_STYLES = {
  solar: "bg-solar",
  grid: "bg-grid",
} as const;

export function ProgressBar({
  label,
  percent,
  color = "solar",
  className = "",
}: {
  label?: string;
  percent: number;
  color?: keyof typeof FILL_STYLES;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className={className}>
      {label && (
        <p className="mb-1 font-mono text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
          {label}
        </p>
      )}
      <div className="relative h-4 w-full border-3 border-black bg-surface-container-lowest">
        <div className={`h-full ${FILL_STYLES[color]}`} style={{ width: `${clamped}%` }} />
        <div className="pointer-events-none absolute inset-0 flex">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="flex-1 border-r-2 border-black last:border-r-0" />
          ))}
        </div>
      </div>
    </div>
  );
}
