"use client";

import { upload } from "@vercel/blob/client";
import { useRef, useState } from "react";
import { FieldError } from "./ActionForm";

/**
 * Video field for admin forms. "Upload video" opens the phone's gallery (or the
 * computer's files); the video goes straight from the browser to video storage
 * with a progress bar. Pasting a link is available as a secondary option.
 */
const MAX_MB = 500;

export function VideoField({ name, label, defaultValue, hint }: { name: string; label: string; defaultValue?: string | null; hint?: string }) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [progress, setProgress] = useState<number | null>(null);
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
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError(`Upload failed: ${(e as Error).message}`);
    } finally {
      setProgress(null);
      abortRef.current = null;
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div>
      <p className="block text-sm font-medium text-deep">{label}</p>
      <input type="hidden" name={name} value={value} />
      <div className="mt-1.5 flex flex-wrap items-center gap-3">
        {progress === null ? (
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
          className="mt-2 block w-full rounded-lg border border-slate/30 bg-white px-3 py-2.5 text-sm text-deep shadow-sm placeholder:text-slate/50 focus:border-sea-deep focus:outline-none focus:ring-2 focus:ring-sea/30"
        />
      )}
      {/* accept="video/*" makes phones open the gallery / camera roll */}
      <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />

      {progress !== null && (
        <div className="mt-3">
          <div className="h-2 overflow-hidden rounded-full bg-foam">
            <div className="h-full bg-sea-deep transition-[width]" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-slate">Uploading… {progress}% — keep this page open.</p>
        </div>
      )}

      {isFile && progress === null && (
        <div className="mt-3 max-w-md overflow-hidden rounded-lg bg-black">
          <video src={value} controls preload="metadata" playsInline className="aspect-video w-full" />
        </div>
      )}
      {value && progress === null && (
        <button type="button" onClick={() => setValue("")} className="mt-2 text-xs text-slate underline hover:text-deep">
          Remove video
        </button>
      )}
      <p className="mt-1.5 text-xs text-slate">
        {hint ?? "Choose a video from your gallery (up to 500 MB). Shorter 1080p clips load fastest for visitors on phones."} After it uploads, click Save.
      </p>
      {error && <p className="mt-1.5 text-xs text-red-700">{error}</p>}
      <FieldError name={name} />
    </div>
  );
}
