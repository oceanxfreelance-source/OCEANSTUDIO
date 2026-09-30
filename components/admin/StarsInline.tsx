/** Compact star display for admin lists, e.g. ★★★★☆ */
export function StarsInline({ value }: { value: number }) {
  return (
    <span className="whitespace-nowrap text-sm tracking-tight" aria-label={`${value} out of 5 stars`}>
      <span className="text-gold-deep">{"★".repeat(value)}</span>
      <span className="text-slate/30">{"★".repeat(Math.max(0, 5 - value))}</span>
    </span>
  );
}
