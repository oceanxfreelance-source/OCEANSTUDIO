"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cx } from "@/components/ui/cx";
import { StarShape } from "./Stars";

/**
 * Floating review badge in the bottom-right corner (phones and desktop):
 * ★ average · number of reviews → opens the Reviews page. Appears after a
 * little scrolling, hides on the Reviews page itself.
 */
export function ReviewBadge({ average, count }: { average: number | null; count: number }) {
  const pathname = usePathname();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 280);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (pathname.startsWith("/reviews")) return null;
  const hasReviews = count > 0 && average !== null;

  return (
    <Link
      href={hasReviews ? "/reviews" : "/reviews#leave-a-review"}
      aria-label={hasReviews ? `Rated ${average.toFixed(1)} out of 5 from ${count} reviews — read reviews` : "Leave a review"}
      className={cx(
        "fixed right-4 z-40 flex items-center gap-2.5 rounded-full border border-gold/30 bg-abyss/85 py-2 pl-3 pr-4 text-foam shadow-[0_18px_40px_-18px_rgba(0,0,0,0.8)] backdrop-blur-xl transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-gold/60 md:right-6",
        "bottom-[calc(1rem+env(safe-area-inset-bottom))] md:bottom-6",
        show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0",
      )}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold/15">
        <StarShape className="h-4 w-4 text-gold" />
      </span>
      {hasReviews ? (
        <span className="leading-tight">
          <span className="block text-sm font-semibold tabular-nums">
            {average.toFixed(1)} <span className="font-normal text-mist">/ 5</span>
          </span>
          <span className="block text-[10px] uppercase tracking-[0.18em] text-mist">
            {count} review{count === 1 ? "" : "s"}
          </span>
        </span>
      ) : (
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">Leave a review</span>
      )}
    </Link>
  );
}
