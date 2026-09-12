export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width={size} height={size}>
      <rect x="8" y="8" width="144" height="144" fill="#22C55E" stroke="#000000" strokeWidth="6" />
      <line x1="8" y1="56" x2="152" y2="56" stroke="#000000" strokeWidth="4" />
      <line x1="8" y1="104" x2="152" y2="104" stroke="#000000" strokeWidth="4" />
      <line x1="56" y1="8" x2="56" y2="152" stroke="#000000" strokeWidth="4" />
      <line x1="104" y1="8" x2="104" y2="152" stroke="#000000" strokeWidth="4" />
      <polygon
        points="88,20 44,84 80,84 68,140 120,72 84,72"
        fill="#FFD600"
        stroke="#000000"
        strokeWidth="5"
        strokeLinejoin="miter"
      />
    </svg>
  );
}
