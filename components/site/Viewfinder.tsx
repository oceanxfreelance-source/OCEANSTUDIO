"use client";

import { useEffect, useRef } from "react";
import { cx } from "@/components/ui/cx";

/**
 * Drone-camera viewfinder drawn over the hero: frame corners, blinking REC
 * with a running timecode, battery + recording format, camera settings and a
 * flight readout, a centre crosshair and faint rule-of-thirds guides.
 * Purely decorative (hidden from screen readers). The timecode is the only JS.
 */
export function Viewfinder({ compact = false }: { compact?: boolean }) {
  const tc = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = tc.current;
    if (!el) return;
    const start = performance.now();
    const pad = (n: number) => String(n).padStart(2, "0");
    const tick = () => {
      const t = (performance.now() - start) / 1000;
      const frames = Math.floor((t % 1) * 25);
      el.textContent = `${pad(Math.floor(t / 3600))}:${pad(Math.floor(t / 60) % 60)}:${pad(Math.floor(t) % 60)}:${pad(frames)}`;
    };
    tick();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(tick, 40);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div aria-hidden className={cx("pointer-events-none absolute inset-0 z-[1] font-mono text-[10px] uppercase tracking-[0.18em] text-foam/75 md:text-[11px]", compact && "opacity-80")}>
      <div className={cx("vf-frame absolute", compact ? "inset-x-4 bottom-4 top-20 md:inset-x-8 md:top-28" : "inset-x-4 bottom-4 top-20 md:inset-x-8 md:bottom-8 md:top-28")}>
        {/* frame corners */}
        <span className="vf-corner left-0 top-0 border-l border-t" />
        <span className="vf-corner right-0 top-0 border-r border-t" />
        <span className="vf-corner bottom-0 left-0 border-b border-l" />
        <span className="vf-corner bottom-0 right-0 border-b border-r" />

        {/* top row: REC + timecode · format + battery */}
        <div className="absolute left-4 top-3 flex items-center gap-3 md:left-6 md:top-4">
          <span className="flex items-center gap-2">
            <span className="rec-dot h-2 w-2 rounded-full bg-[#e5484d]" />
            <span className="text-foam">REC</span>
          </span>
          <span ref={tc} className="tabular-nums">00:00:00:00</span>
        </div>
        <div className="absolute right-4 top-3 flex items-center gap-3 md:right-6 md:top-4">
          <span className="hidden sm:inline">4K · 60FPS</span>
          <span className="flex items-center gap-1.5">
            <span className="relative inline-block h-[9px] w-[18px] rounded-[2px] border border-foam/75 after:absolute after:-right-[3px] after:top-[2px] after:h-[3px] after:w-[2px] after:bg-foam/75">
              <span className="absolute inset-[1px] right-[4px] bg-foam/75" />
            </span>
            <span className="tabular-nums">86%</span>
          </span>
        </div>

        {!compact && (
          <>
            {/* rule of thirds + centre crosshair */}
            <div className="absolute inset-0 hidden md:block">
              <span className="absolute inset-y-0 left-1/3 w-px bg-foam/[0.06]" />
              <span className="absolute inset-y-0 left-2/3 w-px bg-foam/[0.06]" />
              <span className="absolute inset-x-0 top-1/3 h-px bg-foam/[0.06]" />
              <span className="absolute inset-x-0 top-2/3 h-px bg-foam/[0.06]" />
            </div>
            <div className="vf-cross absolute left-1/2 top-[22%] h-8 w-8 -translate-x-1/2 -translate-y-1/2 md:top-[26%]">
              <span className="absolute left-1/2 top-0 h-2 w-px -translate-x-1/2 bg-foam/70" />
              <span className="absolute bottom-0 left-1/2 h-2 w-px -translate-x-1/2 bg-foam/70" />
              <span className="absolute left-0 top-1/2 h-px w-2 -translate-y-1/2 bg-foam/70" />
              <span className="absolute right-0 top-1/2 h-px w-2 -translate-y-1/2 bg-foam/70" />
              <span className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold" />
            </div>

            {/* second row (desktop): camera settings + flight data */}
            <div className="absolute left-4 top-10 hidden gap-5 text-foam/55 md:left-6 md:top-12 md:flex">
              <span>ISO 100</span>
              <span>1/1000</span>
              <span>ƒ 2.8</span>
              <span className="text-gold/90">EV 0.0</span>
            </div>
            <div className="absolute right-4 top-10 hidden gap-5 text-foam/55 md:right-6 md:top-12 md:flex">
              <span>ALT 60M</span>
              <span>H.S 6.2M/S</span>
              <span>D 120M</span>
              <span className="text-gold/90">GPS ●●●●</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
