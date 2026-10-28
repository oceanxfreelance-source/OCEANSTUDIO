"use client";

import { useEffect, useState } from "react";

type Conn = { saveData?: boolean; effectiveType?: string };

/**
 * Silent looping background video for the home hero. Optimised clips (small,
 * H.264) also play on phones; heavy/unknown files only on larger screens.
 * Skipped for data-saver, slow connections and reduced-motion visitors — they
 * keep the still frame underneath.
 */
export function HeroVideo({ src, poster, mobile = false }: { src: string; poster?: string; mobile?: boolean }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const wide = window.matchMedia("(min-width: 768px)").matches;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const conn = (navigator as Navigator & { connection?: Conn }).connection;
    const slow = conn?.saveData || /(^|-)2g|3g/.test(conn?.effectiveType ?? "");
    setShow((wide || mobile) && !calm && !slow);
  }, [mobile]);
  if (!show) return null;
  return <video className="hero-video absolute inset-0 h-full w-full object-cover" src={src} poster={poster} autoPlay muted loop playsInline preload="auto" aria-hidden />;
}
