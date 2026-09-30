"use client";

import { useEffect, useState } from "react";

/**
 * Background video for the home hero — only on screens ≥ 768px and when the
 * visitor hasn't asked for reduced motion / data saving. Phones never download it.
 */
export function HeroVideo({ src, poster }: { src: string; poster?: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const wide = window.matchMedia("(min-width: 768px)").matches;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    setShow(wide && !calm && !saveData);
  }, []);
  if (!show) return null;
  return <video className="absolute inset-0 h-full w-full object-cover" src={src} poster={poster} autoPlay muted loop playsInline preload="auto" aria-hidden />;
}
