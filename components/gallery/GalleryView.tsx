"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError } from "@/lib/client-api";
import { formatBytes, formatDuration } from "@/lib/labels";
import { Brand, GalleryExpired } from "./GalleryStates";

export interface GalleryFile {
  id: string;
  filename: string;
  label: string;
  mediaType: "PHOTO" | "RAW" | "VIDEO";
  size: number;
  width: number | null;
  height: number | null;
  duration: number | null;
  favorite: boolean;
  previewUrl: string | null;
  thumbUrl: string | null;
}

export interface GalleryData {
  title: string;
  expiresAt: string;
  serverTime: string;
  allowFavorites: boolean;
  files: GalleryFile[];
  packages: { id: string; filename: string; size: number; partNumber: number; totalParts: number; fileCount: number }[];
}

type Tab = "photos" | "videos" | "favorites";

function useCountdown(expiresAt: string, serverTime: string) {
  // correct for client clock skew using the server's time at render
  const skew = useMemo(() => new Date(serverTime).getTime() - Date.now(), [serverTime]);
  const [left, setLeft] = useState(() => new Date(expiresAt).getTime() - (Date.now() + skew));
  useEffect(() => {
    const t = setInterval(() => setLeft(new Date(expiresAt).getTime() - (Date.now() + skew)), 1000);
    return () => clearInterval(t);
  }, [expiresAt, skew]);
  const s = Math.max(0, Math.floor(left / 1000));
  const text = `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  return { expired: left <= 0, text };
}

export function GalleryView({ token, initial }: { token: string; initial: GalleryData }) {
  const [data, setData] = useState(initial);
  const [tab, setTab] = useState<Tab>(initial.files.some((f) => f.mediaType !== "VIDEO") ? "photos" : "videos");
  const [open, setOpen] = useState<number | null>(null);
  const [expired, setExpired] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const countdown = useCountdown(data.expiresAt, data.serverTime);

  // Signed preview URLs are short-lived; refresh the listing periodically.
  // The server re-checks expiry on every call — a 410 flips to the expired screen.
  const refresh = useCallback(async () => {
    try {
      setData(await api<GalleryData>(`/api/client/gallery?token=${encodeURIComponent(token)}`));
    } catch (err) {
      if (err instanceof ApiError && (err.status === 410 || err.status === 401 || err.status === 404)) setExpired(true);
    }
  }, [token]);
  useEffect(() => {
    const t = setInterval(refresh, 10 * 60_000);
    return () => clearInterval(t);
  }, [refresh]);
  useEffect(() => {
    if (countdown.expired) void refresh().then(() => setExpired(true));
  }, [countdown.expired, refresh]);

  const photos = data.files.filter((f) => f.mediaType !== "VIDEO");
  const videos = data.files.filter((f) => f.mediaType === "VIDEO");
  const favorites = data.files.filter((f) => f.favorite);
  const list = tab === "photos" ? photos : tab === "videos" ? videos : favorites;

  const download = async (body: { fileId?: string; packageId?: string }) => {
    setBusy(body.fileId ?? body.packageId ?? null);
    setError(null);
    try {
      const { url } = await api<{ url: string }>("/api/client/download", { body: { token, ...body } });
      window.location.assign(url); // short-lived signed URL straight to storage — exact file
    } catch (err) {
      if (err instanceof ApiError && err.status === 410) setExpired(true);
      setError(err instanceof ApiError ? err.message : "Download failed");
    } finally {
      setBusy(null);
    }
  };

  const toggleFavorite = async (f: GalleryFile) => {
    setData((d) => ({ ...d, files: d.files.map((x) => (x.id === f.id ? { ...x, favorite: !f.favorite } : x)) }));
    try {
      await api("/api/client/favorite", { body: { token, fileId: f.id, favorite: !f.favorite } });
    } catch {
      setData((d) => ({ ...d, files: d.files.map((x) => (x.id === f.id ? { ...x, favorite: f.favorite } : x)) }));
    }
  };

  if (expired) return <GalleryExpired />;

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "photos", label: "PHOTOS", count: photos.length },
    { id: "videos", label: "VIDEOS", count: videos.length },
    ...(data.allowFavorites ? [{ id: "favorites" as const, label: "FAVORITES", count: favorites.length }] : []),
  ];

  return (
    <div className="min-h-dvh pb-[env(safe-area-inset-bottom)]">
      <header className="px-5 pb-6 pt-10 text-center sm:pt-14">
        <Brand />
        <h1 className="mt-10 text-2xl font-semibold tracking-tight sm:text-3xl">{data.title}</h1>
        <p className="mt-2 text-xs uppercase tracking-[0.3em] text-mist-400">Private Gallery</p>
        <div className="mt-6 inline-flex flex-col items-center rounded-xl border border-ink-700 bg-ink-850 px-5 py-2.5">
          <span className="text-[10px] uppercase tracking-[0.25em] text-mist-400">Expires in</span>
          <span className="tabular mt-0.5 font-mono text-lg" aria-live="off">
            {countdown.text}
          </span>
        </div>
      </header>

      <nav className="sticky top-0 z-10 border-y border-ink-700 bg-ink-900/90 backdrop-blur" aria-label="Gallery sections">
        <div role="tablist" className="mx-auto flex max-w-5xl justify-center gap-1 px-3">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`-mb-px border-b-2 px-4 py-3.5 text-[11px] font-semibold tracking-[0.2em] ${tab === t.id ? "border-mist-100 text-mist-100" : "border-transparent text-mist-400"}`}
            >
              {t.label} <span className="tabular font-normal text-mist-400">{t.count}</span>
            </button>
          ))}
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-3 py-5 sm:px-5">
        {error && (
          <p role="alert" className="mb-4 text-center text-sm text-coral-400">
            {error}
          </p>
        )}
        {list.length === 0 ? (
          <p className="py-20 text-center text-sm text-mist-400">{tab === "favorites" ? "Tap ♡ on a photo to add it to your favorites." : "Nothing here."}</p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
            {list.map((f) => (
              <li key={f.id} className="group relative overflow-hidden rounded-lg bg-ink-850">
                <button onClick={() => setOpen(data.files.indexOf(f))} className="block w-full" aria-label={`Open ${f.filename}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {f.thumbUrl ? <img src={f.thumbUrl} alt={f.filename} loading="lazy" className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" /> : <div className="aspect-square" />}
                  {f.mediaType === "VIDEO" && <span className="absolute bottom-2 left-2 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[11px]">▶ {formatDuration(f.duration)}</span>}
                </button>
                {data.allowFavorites && f.mediaType !== "VIDEO" && (
                  <button onClick={() => toggleFavorite(f)} aria-pressed={f.favorite} aria-label={f.favorite ? "Remove from favorites" : "Add to favorites"} className="absolute right-1.5 top-1.5 grid size-9 place-items-center rounded-full bg-black/40 text-lg backdrop-blur">
                    <span className={f.favorite ? "text-coral-400" : "text-white"}>{f.favorite ? "♥" : "♡"}</span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {data.packages.length > 0 && (
          <section className="mx-auto mt-10 max-w-md rounded-2xl border border-ink-700 bg-ink-850 p-5">
            <h2 className="text-[11px] font-semibold tracking-[0.25em] text-mist-400">DOWNLOAD ALL</h2>
            <ul className="mt-3 space-y-2">
              {data.packages.map((p) => (
                <li key={p.id}>
                  <button onClick={() => download({ packageId: p.id })} disabled={busy === p.id} className="flex h-12 w-full items-center justify-between rounded-xl bg-ink-750 px-4 text-sm hover:bg-ink-700 disabled:opacity-60">
                    <span className="truncate">{p.totalParts > 1 ? `Part ${p.partNumber} of ${p.totalParts}` : "All files (ZIP)"}</span>
                    <span className="tabular text-xs text-mist-400">
                      {p.fileCount} {p.fileCount === 1 ? "file" : "files"} · {formatBytes(p.size)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        <p className="mx-auto mt-10 max-w-md text-center text-xs leading-relaxed text-mist-400">
          Original files are delivered without resizing or unnecessary compression. Enhanced files are delivered in the exact final format selected by the photographer.
        </p>
      </main>

      {open !== null && data.files[open] && (
        <Lightbox
          files={data.files}
          index={open}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
          onDownload={(f) => download({ fileId: f.id })}
          busy={busy}
          allowFavorites={data.allowFavorites}
          onFavorite={toggleFavorite}
        />
      )}
    </div>
  );
}

function Lightbox({
  files,
  index,
  onIndex,
  onClose,
  onDownload,
  busy,
  allowFavorites,
  onFavorite,
}: {
  files: GalleryFile[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  onDownload: (f: GalleryFile) => void;
  busy: string | null;
  allowFavorites: boolean;
  onFavorite: (f: GalleryFile) => void;
}) {
  const f = files[index]!;
  const touch = useRef<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const prev = useCallback(() => onIndex((index - 1 + files.length) % files.length), [index, files.length, onIndex]);
  const next = useCallback(() => onIndex((index + 1) % files.length), [index, files.length, onIndex]);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, prev, next]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={f.filename}
      className="fixed inset-0 z-50 flex animate-fade-in flex-col bg-black"
      onTouchStart={(e) => (touch.current = e.touches[0]!.clientX)}
      onTouchEnd={(e) => {
        if (touch.current === null) return;
        const dx = e.changedTouches[0]!.clientX - touch.current;
        if (Math.abs(dx) > 50) (dx > 0 ? prev : next)();
        touch.current = null;
      }}
    >
      <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-[max(12px,env(safe-area-inset-top))]">
        <button ref={closeRef} onClick={onClose} className="grid size-10 place-items-center rounded-full text-xl text-mist-200 hover:bg-white/10" aria-label="Close">
          ✕
        </button>
        <p className="tabular text-xs text-mist-400">
          {index + 1} / {files.length}
        </p>
        {allowFavorites && f.mediaType !== "VIDEO" ? (
          <button onClick={() => onFavorite(f)} aria-pressed={f.favorite} aria-label={f.favorite ? "Remove from favorites" : "Add to favorites"} className="grid size-10 place-items-center rounded-full text-xl hover:bg-white/10">
            <span className={f.favorite ? "text-coral-400" : "text-white"}>{f.favorite ? "♥" : "♡"}</span>
          </button>
        ) : (
          <span className="size-10" />
        )}
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        {f.mediaType === "VIDEO" ? (
          <video key={f.id} src={f.previewUrl ?? undefined} controls playsInline autoPlay className="max-h-full max-w-full" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={f.id} src={f.previewUrl ?? f.thumbUrl ?? undefined} alt={f.filename} className="max-h-full max-w-full select-none object-contain" draggable={false} />
        )}
        <button onClick={prev} className="absolute left-2 top-1/2 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-xl hover:bg-white/20 sm:grid" aria-label="Previous">
          ‹
        </button>
        <button onClick={next} className="absolute right-2 top-1/2 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-xl hover:bg-white/20 sm:grid" aria-label="Next">
          ›
        </button>
      </div>
      <div className="flex items-center justify-between gap-3 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
        <div className="min-w-0">
          <p className="truncate text-sm">{f.filename}</p>
          <p className="text-[11px] text-mist-400">
            <span className="mr-1.5 rounded bg-white/10 px-1.5 py-0.5 font-semibold tracking-wider text-mist-200">{f.label}</span>
            {f.width && f.height ? `${f.width}×${f.height} · ` : ""}
            {formatBytes(f.size)}
          </p>
        </div>
        <button onClick={() => onDownload(f)} disabled={busy === f.id} className="h-11 shrink-0 rounded-xl bg-mist-100 px-5 text-sm font-semibold text-ink-950 hover:bg-white disabled:opacity-60">
          {busy === f.id ? "Preparing…" : "Download"}
        </button>
      </div>
    </div>
  );
}
