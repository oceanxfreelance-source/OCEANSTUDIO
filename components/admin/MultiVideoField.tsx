"use client";

import { useRef, useState } from "react";
import { needsOptimising, posterFor } from "@/lib/video";
import { FieldError } from "./ActionForm";
import { checkVideoFile, optimiseVideo, uploadVideo } from "./video-client";

type Job = { key: string; name: string; status: "waiting" | "uploading" | "optimising" | "error"; progress: number; message?: string };

/**
 * A list of videos for one portfolio piece. "Add videos" opens the gallery with
 * multi-select; each clip is uploaded, optimised for every phone and appended
 * to the list, one after another. Videos can be reordered (the first is the
 * main video and cover) or removed. Saved as repeated `name` hidden inputs.
 */
export function MultiVideoField({ name, label, defaultValue }: { name: string; label: string; defaultValue?: string[] }) {
  const [videos, setVideos] = useState<string[]>(defaultValue ?? []);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [optimising, setOptimising] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const [showLink, setShowLink] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const busy = jobs.some((j) => j.status !== "error") || optimising !== null;

  const updateJob = (key: string, patch: Partial<Job>) => setJobs((js) => js.map((j) => (j.key === key ? { ...j, ...patch } : j)));

  async function addFiles(files: File[]) {
    if (!files.length) return;
    const batch = files.map((file, i) => ({ file, key: `${Date.now()}-${i}` }));
    setJobs((js) => [...js, ...batch.map(({ file, key }) => ({ key, name: file.name, status: "waiting" as const, progress: 0 }))]);
    for (const { file, key } of batch) {
      const problem = checkVideoFile(file);
      if (problem) {
        updateJob(key, { status: "error", message: problem });
        continue;
      }
      try {
        updateJob(key, { status: "uploading" });
        let url = await uploadVideo(file, (progress) => updateJob(key, { progress }));
        updateJob(key, { status: "optimising" });
        let warning: string | undefined;
        try {
          url = await optimiseVideo(url);
        } catch (e) {
          warning = `${(e as Error).message} Added anyway — tap "Optimise" on it.`;
        }
        setVideos((vs) => [...vs, url]);
        if (warning) updateJob(key, { status: "error", message: warning });
        else setJobs((js) => js.filter((j) => j.key !== key));
      } catch (e) {
        updateJob(key, { status: "error", message: `Upload failed: ${(e as Error).message}` });
      }
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function optimiseOne(url: string) {
    setOptimising(url);
    setError(null);
    try {
      const next = await optimiseVideo(url);
      setVideos((vs) => vs.map((v) => (v === url ? next : v)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOptimising(null);
    }
  }

  function move(i: number, by: -1 | 1) {
    setVideos((vs) => {
      const j = i + by;
      if (j < 0 || j >= vs.length) return vs;
      const next = [...vs];
      const [moved] = next.splice(i, 1);
      next.splice(j, 0, moved!);
      return next;
    });
  }

  function addLink() {
    const v = link.trim();
    if (!/^https?:\/\/\S+$/i.test(v)) {
      setError("Enter a full link starting with https://");
      return;
    }
    if (videos.includes(v)) {
      setError("This video is already in the list.");
      return;
    }
    setVideos((vs) => [...vs, v]);
    setLink("");
    setError(null);
  }

  return (
    <div>
      <p className="block text-sm font-medium text-deep">
        {label} {videos.length > 0 && <span className="font-normal text-slate">({videos.length})</span>}
      </p>
      {videos.map((v) => (
        <input key={v} type="hidden" name={name} value={v} />
      ))}

      {videos.length > 0 && (
        <ul className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {videos.map((v, i) => {
            const poster = posterFor(v);
            const isFile = /\.(mp4|mov|m4v|webm)(\?|$)/i.test(v);
            return (
              <li key={v} className="overflow-hidden rounded-lg border border-slate/15 bg-white">
                <div className="relative aspect-[4/5] bg-black">
                  {poster ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={poster} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : isFile ? (
                    <video src={`${v}#t=0.1`} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full items-center justify-center break-all p-2 text-center text-[11px] text-white/70">{v}</span>
                  )}
                  {i === 0 && <span className="absolute left-2 top-2 rounded bg-gold px-1.5 py-0.5 text-[10px] font-semibold text-abyss">Main</span>}
                  {optimising === v && <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-xs text-white">Optimising…</span>}
                </div>
                <div className="flex items-center gap-1 p-1.5 text-xs">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move video ${i + 1} earlier`} className="rounded px-2 py-1 hover:bg-foam disabled:opacity-30">
                    ←
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === videos.length - 1} aria-label={`Move video ${i + 1} later`} className="rounded px-2 py-1 hover:bg-foam disabled:opacity-30">
                    →
                  </button>
                  <button type="button" onClick={() => setVideos((vs) => vs.filter((x) => x !== v))} aria-label={`Remove video ${i + 1}`} className="ml-auto rounded px-2 py-1 text-red-700 hover:bg-red-50">
                    Remove
                  </button>
                </div>
                {needsOptimising(v) && optimising !== v && (
                  <button type="button" onClick={() => optimiseOne(v)} disabled={busy} className="block w-full border-t border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] font-semibold text-amber-900 disabled:opacity-50">
                    Optimise for phones
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => fileRef.current?.click()} className="rounded-lg bg-abyss px-5 py-3 text-sm font-semibold text-white hover:bg-ink-3">
          {videos.length ? "+ Add more videos" : "Add videos"}
        </button>
        {!showLink && (
          <button type="button" onClick={() => setShowLink(true)} className="text-xs text-slate underline hover:text-deep">
            or paste a link
          </button>
        )}
      </div>
      {/* accept="video/*" + multiple: phones open the gallery with multi-select */}
      <input ref={fileRef} type="file" accept="video/*" multiple aria-label="Add videos" className="hidden" onChange={(e) => addFiles(Array.from(e.target.files ?? []))} />

      {showLink && (
        <div className="mt-2 flex gap-2">
          <input
            type="url"
            aria-label={`${label} link`}
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addLink())}
            placeholder="https://…"
            className="block w-full rounded-lg border border-slate/30 bg-white px-3 py-2.5 text-sm text-deep shadow-sm placeholder:text-slate/50 focus:border-gold-deep focus:outline-none focus:ring-2 focus:ring-gold/30"
          />
          <button type="button" onClick={addLink} className="rounded-lg border border-slate/30 bg-white px-4 text-sm font-semibold hover:bg-foam">
            Add
          </button>
        </div>
      )}

      {jobs.length > 0 && (
        <ul className="mt-3 divide-y divide-slate/10 rounded-lg border border-slate/15 bg-white text-sm">
          {jobs.map((j) => (
            <li key={j.key} className="px-3 py-2.5">
              <div className="flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate">{j.name}</span>
                <span className={j.status === "error" ? "text-red-700" : "text-slate"}>
                  {j.status === "waiting" && "Waiting"}
                  {j.status === "uploading" && `Uploading ${j.progress}%`}
                  {j.status === "optimising" && "Optimising…"}
                  {j.status === "error" && (
                    <button type="button" onClick={() => setJobs((js) => js.filter((x) => x.key !== j.key))} className="underline">
                      Dismiss
                    </button>
                  )}
                </span>
              </div>
              {j.status === "uploading" && (
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-foam">
                  <div className="h-full bg-gold-deep transition-[width]" style={{ width: `${j.progress}%` }} />
                </div>
              )}
              {j.message && <p className="mt-1 text-xs text-red-700">{j.message}</p>}
            </li>
          ))}
        </ul>
      )}
      {busy && <p className="mt-2 text-xs font-medium">Keep this page open. Click Save when every video is added.</p>}
      <p className="mt-1.5 text-xs text-slate">
        Choose one or many clips from your gallery or the DJI app (up to 500 MB and 2½ minutes each). They&apos;re converted so every phone can play them. The first video is the main one — use ← → to reorder. Click Save when done.
      </p>
      {error && <p className="mt-1.5 text-xs text-red-700">{error}</p>}
      <FieldError name={name} />
    </div>
  );
}
