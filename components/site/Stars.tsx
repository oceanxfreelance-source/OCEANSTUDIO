import { cx } from "@/components/ui/cx";

/** Read-only star rating, e.g. <Stars value={4.5} />. */
export function Stars({ value, size = "h-4 w-4", className }: { value: number; size?: string; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-0.5", className)} role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, value - (i - 1)));
        return (
          <span key={i} className={cx("relative inline-block", size)}>
            <StarShape className="absolute inset-0 h-full w-full text-current opacity-20" />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <span className="star-fill block h-full" style={{ "--s": i } as React.CSSProperties}>
                <StarShape className={cx("h-full text-gold", size)} />
              </span>
            </span>
          </span>
        );
      })}
    </span>
  );
}

export function StarShape({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path fill="currentColor" d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" />
    </svg>
  );
}
