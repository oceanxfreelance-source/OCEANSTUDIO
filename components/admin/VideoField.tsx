"use client";

import { upload } from "@vercel/blob/client";
import { needsOptimising, posterFor } from "@/lib/video";
import { useRef, useState } from "react";
import { FieldError } from "./ActionForm";

/**
 * Video field for admin forms. "Upload video" opens the phone's gallery (or the
 * computer's files); the video goes straight from the browser to video storage
 * with a progress bar, then the server converts it into a version every phone
 * can play (H.264 1080p, streaming-ready, with a cover frame). Pasting a link
 * is available as a secondary option.
 */
const MAX_MB = 500;

export function VideoField({ name, label, defaultValue, hint }: { name: string; label: string; defaultValue?: string | null; hint?: string }) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [progress, setProgress] = useState<number | null>(null);
  const [optimising, setOptimising] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLink, setShowLink] = useState(!!defaultValue && !/\.(mp4|mov|m4v|webm)(\?|$)/i.test(defaultValue));
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const isFile = /\.(mp4|mov|m4v|webm)(\?|$)/i.test(value);

  async function onFile(file: File) {
    setError(null);
    if (!/^video\//.test(file.type) && !/\.(mp4|mov|m4v|webm)$/i.test(file.name)) {
      setError("Please choose a video.");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`This video is ${Math.round(file.size / 1024 / 1024)} MB. The limit is ${MAX_MB} MB — export a shorter or 1080p version.`);
      return;
    }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setProgress(0);
    try {
      const ext = (file.name.match(/\.(mp4|mov|m4v|webm)$/i)?.[1] ?? (file.type === "video/quicktime" ? "mov" : "mp4")).toLowerCase();
      const safeName = `${file.name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) || "video"}.${ext}`;
      const blob = await upload(`videos/${safeName}`, file, {
        access: "public",
        handleUploadUrl: "/api/admin/video-upload",
        contentType: file.type || "video/mp4",
        multipart: file.size > 20 * 1024 * 1024,
        abortSignal: ctrl.signal,
        onUploadProgress: (p) => setProgress(Math.round(p.percentage)),
      });
      setValue(blob.url);
      setProgress(null);
      await optimise(blob.url);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError(`Upload failed: ${(e as Error).message}`);
    } finally {
      setProgress(null);
      abortRef.current = null;
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  /** Convert on the server into the phone-friendly version (~30–90 s). */
  async function optimise(url: string) {
    setOptimising(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/video-optimize", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) });
      const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? `Error ${res.status}`);
      setValue(json.url);
    } catch (e) {
      setError(`${(e as Error).message} The original is kept, but it may not play on every phone.`);
    } finally {
      setOptimising(false);
    }
  }

  return (
    <div>
      <p className="block text-sm font-medium text-deep">{label}</p>
      <input type="hidden" name={name} value={value} />
      <div className="mt-1.5 flex flex-wrap items-center gap-3">
        {optimising ? null : progress === null ? (
          <button type="button" onClick={() => fileRef.current?.click()} className="rounded-lg bg-abyss px-5 py-3 text-sm font-semibold text-white hover:bg-ink-3">
            {value ? "Replace video" : "Upload video"}
          </button>
        ) : (
          <button type="button" onClick={() => abortRef.current?.abort()} className="rounded-lg border border-slate/30 bg-white px-5 py-3 text-sm font-semibold hover:bg-foam">
            Cancel upload
          </button>
        )}
        {!showLink && progress === null && (
          <button type="button" onClick={() => setShowLink(true)} className="text-xs text-slate underline hover:text-deep">
            or paste a link instead
          </button>
        )}
      </div>
      {showLink && (
        <input
          type="url"
          aria-label={`${label} link`}
          value={isFile ? "" : value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="https://…"
          className="mt-2 block w-full rounded-lg border border-slate/30 bg-white px-3 py-2.5 text-sm text-deep shadow-sm placeholder:text-slate/50 focus:border-gold-deep focus:outline-none focus:ring-2 focus:ring-gold/30"
        />
      )}
      {/* accept="video/*" makes phones open the gallery / camera roll */}
      <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />

      {progress !== null && (
        <div className="mt-3">
          <div className="h-2 overflow-hidden rounded-full bg-foam">
            <div className="h-full bg-gold-deep transition-[width]" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-slate">Uploading… {progress}% — keep this page open.</p>
        </div>
      )}

      {optimising && (
        <div className="mt-3 max-w-md rounded-lg border border-gold/40 bg-gold/10 p-4">
          <p className="text-sm font-semibold">Optimising for every phone…</p>
          <p className="mt-0.5 text-xs text-slate">Usually under a minute. Keep this page open.</p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white">
            <div className="h-full w-1/3 animate-[indeterminate_1.4s_ease-in-out_infinite] rounded-full bg-gold-deep" />
          </div>
        </div>
      )}

      {isFile && progress === null && !optimising && (
        <div className="mt-3 max-w-xs overflow-hidden rounded-lg bg-black">
          <video src={value} poster={posterFor(value) ?? undefined} controls preload="metadata" playsInline className="max-h-80 w-full" />
        </div>
      )}
      {needsOptimising(value) && progress === null && !optimising && (
        <div className="mt-3 flex max-w-md flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <span className="flex-1">This video isn&apos;t optimised yet, so some phones can&apos;t play it.</span>
          <button type="button" onClick={() => optimise(value)} className="rounded-md bg-abyss px-3 py-1.5 font-semibold text-white">
            Optimise for phones
          </button>
        </div>
      )}
      {posterFor(value) && !optimising && <p className="mt-2 text-xs text-emerald-700">✓ Optimised — plays on all phones.</p>}
      {value && progress === null && !optimising && (
        <button type="button" onClick={() => setValue("")} className="mt-2 text-xs text-slate underline hover:text-deep">
          Remove video
        </button>
      )}
      <p className="mt-1.5 text-xs text-slate">
        {hint ?? "Choose a video straight from your gallery or the DJI app (up to 500 MB, 2½ minutes). It's automatically converted so every phone can play it."} When it says Optimised, click Save.
      </p>
      {error && <p className="mt-1.5 text-xs text-red-700">{error}</p>}
      <FieldError name={name} />
    </div>
  );
}
