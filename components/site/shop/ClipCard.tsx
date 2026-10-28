"use client";

import { useState } from "react";
import { cx } from "@/components/ui/cx";
import { SLOT_LABEL, type CartClip, type Slot } from "@/lib/shop-rules";
import { Play } from "../Icons";
import { useCart } from "./cart";

export type ClipCardData = {
  id: string;
  code: string;
  date: string; // YYYY-MM-DD
  dateLabel: string;
  slot: Slot;
  spot: string; // code
  spotName: string;
  description: string;
  seconds: number | null;
  previewUrl: string | null;
  posterUrl: string | null;
};

/**
 * A clip in the gallery. Only the small cover frame loads at first; tapping it
 * plays the short watermarked preview (muted, inline). "Add" puts it in the cart.
 */
export function ClipCard({ clip }: { clip: ClipCardData }) {
  const cart = useCart();
  const [playing, setPlaying] = useState(false);
  const inCart = cart.has(clip.id);
  const item: CartClip = { id: clip.id, code: clip.code, date: clip.date, slot: clip.slot, spot: clip.spot, spotName: clip.spotName, poster: clip.posterUrl };

  return (
    <article className={cx("group overflow-hidden rounded-xl border bg-ink transition-colors", inCart ? "border-gold" : "border-foam/10")}>
      <div className="relative aspect-[4/5] bg-abyss">
        {playing && clip.previewUrl ? (
          <video src={clip.previewUrl} poster={clip.posterUrl ?? undefined} autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover" aria-label={`Preview of clip ${clip.code}`} />
        ) : (
          <button type="button" onClick={() => setPlaying(true)} aria-label={`Play preview of clip ${clip.code}`} className="absolute inset-0 flex items-center justify-center">
            {clip.posterUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={clip.posterUrl} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
            )}
            <span className="relative flex h-12 w-12 items-center justify-center rounded-full border border-gold/60 bg-abyss/50 text-gold backdrop-blur">
              <Play className="ml-0.5 h-5 w-5" />
            </span>
          </button>
        )}
        <span className="pointer-events-none absolute left-2 top-2 rounded-sm bg-abyss/75 px-1.5 py-0.5 font-mono text-[11px] tracking-wide text-foam">{clip.code}</span>
        {clip.seconds && <span className="pointer-events-none absolute right-2 top-2 rounded-sm bg-abyss/75 px-1.5 py-0.5 text-[11px] text-foam/80">{Math.round(clip.seconds)}s</span>}
      </div>
      <div className="space-y-2.5 p-3">
        <p className={cx("line-clamp-2 min-h-[2.5em] text-sm", clip.description ? "text-foam" : "text-foam/40")} title={`${clip.spotName} · ${SLOT_LABEL[clip.slot]} · ${clip.dateLabel}`}>
          {clip.description || "Tap the video to check if it's you"}
        </p>
        <button
          type="button"
          onClick={() => cart.toggle(item)}
          aria-pressed={inCart}
          className={cx("w-full rounded-full py-2.5 text-[11px] font-semibold tracking-[0.16em] transition-colors", inCart ? "bg-gold text-abyss" : "border border-foam/25 text-foam hover:border-gold hover:text-gold")}
        >
          {inCart ? "✓ ADDED" : "+ ADD — THIS IS ME"}
        </button>
      </div>
    </article>
  );
}
