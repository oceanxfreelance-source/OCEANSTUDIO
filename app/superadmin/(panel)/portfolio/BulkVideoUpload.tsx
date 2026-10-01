"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { checkVideoFile, optimiseVideo, uploadVideo } from "@/components/admin/video-client";
import { createVideoItem } from "./actions";

type Job = {
  key: string;
  name: string;
  status: "waiting" | "uploading" | "optimising" | "done" | "error";
  progress: number;
  message?: string;
  itemId?: string;
};

/**
 * "Add many videos": pick several clips from the gallery at once. Each one is
 * uploaded, optimised for every phone, and published as its own portfolio item,
 * one after another, with a status row per clip.
 */
export function BulkVideoUpload() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [running, setRunning] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const update = (key: string, patch: Partial<Job>) => setJobs((js) => js.map((j) => (j.key === key ? { ...j, ...patch } : j)));

  async function start(files: File[]) {
    if (!files.length) return;
    const batch = files.map((f, i) => ({ file: f, key: `${Date.now()}-${i}` }));
    setJobs((js) => [...js, ...batch.map(({ file, key }) => ({ key, name: file.name, status: "waiting" as const, progress: 0 }))]);
    setRunning(true);
    for (const { file, key } of batch) {
      const problem = checkVideoFile(file);
      if (problem) {
        update(key, { status: "error", message: problem });
        continue;
      }
      try {
        update(key, { status: "uploading" });
        let url = await uploadVideo(file, (progress) => update(key, { progress }));
        update(key, { status: "optimising" });
        let warning: string | undefined;
        try {
          url = await optimiseVideo(url);
        } catch (e) {
          warning = `${(e as Error).message} Added anyway — open it and tap "Optimise for phones".`;
        }
        const item = await createVideoItem(url, file.lastModified || null);
        update(key, { status: warning ? "error" : "done", itemId: item.id, message: warning ?? `Published as “${item.title}”` });
      } catch (e) {
        update(key, { status: "error", message: `Upload failed: ${(e as Error).message}` });
      }
    }
    setRunning(false);
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
  }

  return (
    <div className="mb-6 rounded-xl border border-gold/40 bg-gold/10 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold">Add many videos</p>
          <p className="mt-0.5 text-xs text-slate">Pick several clips from your gallery. Each one becomes its own published Surf video at Machines — rename them later.</p>
        </div>
        <button type="button" disabled={running} onClick={() => fileRef.current?.click()} className="rounded-lg bg-abyss px-5 py-3 text-sm font-semibold text-white hover:bg-ink-3 disabled:opacity-50">
          {running ? "Working…" : "Choose videos"}
        </button>
      </div>
      <input ref={fileRef} type="file" accept="video/*" multiple aria-label="Choose videos" className="hidden" onChange={(e) => start(Array.from(e.target.files ?? []))} />

      {jobs.length > 0 && (
        <ul className="mt-4 divide-y divide-slate/10 rounded-lg border border-slate/15 bg-white text-sm">
          {jobs.map((j) => (
            <li key={j.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
              <span className="min-w-0 flex-1 truncate font-medium">{j.name}</span>
              <span className={j.status === "done" ? "text-emerald-700" : j.status === "error" ? "text-red-700" : "text-slate"}>
                {j.status === "waiting" && "Waiting"}
                {j.status === "uploading" && `Uploading ${j.progress}%`}
                {j.status === "optimising" && "Optimising…"}
                {j.status === "done" && "✓ Done"}
                {j.status === "error" && "Needs attention"}
              </span>
              {j.message && (
                <span className="basis-full text-xs text-slate">
                  {j.message}
                  {j.itemId && (
                    <>
                      {" "}
                      <Link href={`/superadmin/portfolio/${j.itemId}`} className="text-gold-deep underline">
                        Edit
                      </Link>
                    </>
                  )}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {running && <p className="mt-3 text-xs font-medium">Keep this page open until every clip says Done.</p>}
    </div>
  );
}
