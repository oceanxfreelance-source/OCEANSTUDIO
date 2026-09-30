import Link from "next/link";
import { cx } from "@/components/ui/cx";

/** Wordmark: OCEAN X with a small wave under the X. */
export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" aria-label="OCEAN X — home" className={cx("group inline-flex items-center gap-2.5", className)}>
      <span className="display text-[19px] tracking-[0.18em] [font-stretch:125%]">
        OCEAN<span className="ml-[0.35em] text-gold">X</span>
      </span>
    </Link>
  );
}
