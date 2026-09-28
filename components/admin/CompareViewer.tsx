"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, cx, QualityLabel, Segmented } from "@/components/ui";

export interface CompareImage {
  label: string;
  isAi: boolean;
  width: number | null;
  height: number | null;
  previewUrl: string | null;
  detailUrl: string | null;
  filename: string;
}

export interface FaceBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Zoom = "fit" | 0.5 | 1 | 2;

/**
 * ORIGINAL vs ENHANCED inspection: before/after slider, side-by-side, fit /
 * 50 / 100 / 200 % zoom with synchronised panning, face zoom (camera or XMP
 * face regions) and click-to-inspect detail zoom. 100 % uses the full
 * resolution inspection image; when the file is larger than that image the
 * viewer states the effective resolution instead of pretending.
 */
export function CompareViewer({ before, after, faces = [] }: { before: CompareImage; after: CompareImage; faces?: FaceBox[] }) {
  const [mode, setMode] = useState<"slider" | "side">("slider");
  const [zoom, setZoom] = useState<Zoom>("fit");
  const [center, setCenter] = useState({ x: 0.5, y: 0.5 });
  const [split, setSplit] = useState(50);
  const [box, setBox] = useState({ w: 800, h: 520 });
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);

  const nativeW = after.width ?? before.width ?? 1600;
  const nativeH = after.height ?? before.height ?? 1067;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBox({ w: e!.contentRect.width / (mode === "side" ? 2 : 1), h: e!.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [mode]);

  const fitScale = Math.min(box.w / nativeW, box.h / nativeH);
  const scale = zoom === "fit" ? fitScale : zoom;
  const W = nativeW * scale;
  const H = nativeH * scale;
  const left = zoom === "fit" ? (box.w - W) / 2 : Math.min(0, Math.max(box.w - W, box.w / 2 - center.x * W));
  const top = zoom === "fit" ? (box.h - H) / 2 : Math.min(0, Math.max(box.h - H, box.h / 2 - center.y * H));
  const useDetail = zoom !== "fit" && scale > fitScale * 1.2;
  const src = (img: CompareImage) => (useDetail ? img.detailUrl ?? img.previewUrl : img.previewUrl) ?? undefined;
  const inspectPct = after.width ? Math.min(100, Math.round((Math.min(8192, after.width) / after.width) * 100)) : null;

  const onPointerDown = (e: React.PointerEvent) => {
    if (zoom === "fit") return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, cx: center.x, cy: center.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    setCenter({
      x: Math.min(1, Math.max(0, drag.current.cx - (e.clientX - drag.current.x) / W)),
      y: Math.min(1, Math.max(0, drag.current.cy - (e.clientY - drag.current.y) / H)),
    });
  };
  const onClick = (e: React.MouseEvent) => {
    if (zoom !== "fit") return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const px = (e.clientX - rect.left - left) / W;
    const py = (e.clientY - rect.top - top) / H;
    if (px < 0 || px > 1 || py < 0 || py > 1) return;
    setCenter({ x: px, y: py });
    setZoom(1);
  };
  const onKey = useCallback(
    (e: React.KeyboardEvent) => {
      const step = 0.05;
      if (e.key === "ArrowLeft") setCenter((c) => ({ ...c, x: Math.max(0, c.x - step) }));
      else if (e.key === "ArrowRight") setCenter((c) => ({ ...c, x: Math.min(1, c.x + step) }));
      else if (e.key === "ArrowUp") setCenter((c) => ({ ...c, y: Math.max(0, c.y - step) }));
      else if (e.key === "ArrowDown") setCenter((c) => ({ ...c, y: Math.min(1, c.y + step) }));
      else if (e.key === "+" || e.key === "=") setZoom((z) => (z === "fit" ? 0.5 : z === 0.5 ? 1 : 2));
      else if (e.key === "-") setZoom((z) => (z === 2 ? 1 : z === 1 ? 0.5 : "fit"));
      else if (mode === "slider" && e.key === ",") setSplit((s) => Math.max(0, s - 5));
      else if (mode === "slider" && e.key === ".") setSplit((s) => Math.min(100, s + 5));
      else return;
      e.preventDefault();
    },
    [mode],
  );

  const imgStyle = { position: "absolute" as const, left, top, width: W, height: H, maxWidth: "none", imageRendering: scale >= 2 ? ("pixelated" as const) : undefined };

  const pane = (img: CompareImage, extra?: React.CSSProperties) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src(img)} alt={`${img.label} — ${img.filename}`} draggable={false} style={{ ...imgStyle, ...extra }} className="select-none" />
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Segmented label="Compare mode" value={mode} onChange={setMode} options={[{ value: "slider", label: "Slider" }, { value: "side", label: "Side by side" }]} />
          <Segmented
            label="Zoom"
            value={zoom}
            onChange={setZoom}
            options={[
              { value: "fit", label: "Fit" },
              { value: 0.5, label: "50%" },
              { value: 1, label: "100%" },
              { value: 2, label: "200%" },
            ]}
          />
        </div>
        <div className="flex items-center gap-2">
          {faces.map((f, i) => (
            <Button
              key={i}
              size="sm"
              variant="ghost"
              onClick={() => {
                setCenter({ x: f.x + f.w / 2, y: f.y + f.h / 2 });
                setZoom(1);
              }}
            >
              Face {i + 1}
            </Button>
          ))}
          {faces.length === 0 && <span className="text-xs text-mist-400">Click the image to inspect detail at 100%</span>}
        </div>
      </div>

      <div
        ref={ref}
        tabIndex={0}
        role="application"
        aria-label="Before and after comparison. Arrow keys pan, plus and minus zoom, comma and period move the slider."
        onKeyDown={onKey}
        className={cx("checker relative h-[62vh] min-h-[420px] overflow-hidden rounded-xl border border-ink-700", zoom === "fit" ? "cursor-zoom-in" : "cursor-grab active:cursor-grabbing", mode === "side" && "grid grid-cols-2")}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => (drag.current = null)}
        onClick={onClick}
      >
        {mode === "slider" ? (
          <>
            {pane(before)}
            {pane(after, { clipPath: `inset(0 0 0 ${split}%)` })}
            <div className="pointer-events-none absolute inset-y-0 w-px bg-white/80" style={{ left: `${split}%` }} />
            <input
              type="range"
              min={0}
              max={100}
              value={split}
              onChange={(e) => setSplit(Number(e.target.value))}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label="Before/after split position"
              className="absolute bottom-3 left-1/2 w-1/2 -translate-x-1/2"
            />
          </>
        ) : (
          <>
            <div className="relative overflow-hidden border-r border-ink-700">{pane(before)}</div>
            <div className="relative overflow-hidden">{pane(after)}</div>
          </>
        )}
        <div className="pointer-events-none absolute left-3 top-3">
          <QualityLabel label={before.label} ai={before.isAi} />
        </div>
        <div className="pointer-events-none absolute right-3 top-3">
          <QualityLabel label={after.label} ai={after.isAi} />
        </div>
      </div>
      <p className="text-xs text-mist-400">
        {zoom === "fit" ? "Fit to view (preview image)." : `${Math.round(scale * 100)}% of the ${after.label.toLowerCase()} file (${nativeW}×${nativeH}).`}
        {zoom !== "fit" && inspectPct !== null && inspectPct < 100 && ` Inspection image holds ${inspectPct}% of full resolution; download the file for pixel-exact review.`}
      </p>
    </div>
  );
}
