"use client";

import { useCallback, useRef, useState } from "react";
import { Button, cx, Progress } from "@/components/ui";
import { api, ApiError } from "@/lib/client-api";
import { formatBytes } from "@/lib/labels";

const ACCEPT = ".nef,.nrw,.dng,.cr2,.cr3,.arw,.raf,.orf,.rw2,.jpg,.jpeg,.png,.tif,.tiff,.webp,.mp4,.mov,.m4v,.avi,.mkv";
const PART_CONCURRENCY = 4;
const FILE_CONCURRENCY = 2;
const MAX_PART_RETRIES = 5;

type UploadState = "queued" | "uploading" | "completing" | "done" | "error" | "cancelled";
interface Item {
  id: string;
  file: File;
  state: UploadState;
  loaded: number;
  error?: string;
  mediaId?: string;
  resumed?: boolean;
}

interface CreateRes {
  mediaId: string;
  uploadId: string;
  partSize: number;
  partCount: number;
}

const resumeKey = (projectId: string, f: File) => `oceanx-upload:${projectId}:${f.name}:${f.size}:${f.lastModified}`;

function putPart(url: string, blob: Blob, onProgress: (loaded: number) => void, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const etag = xhr.getResponseHeader("ETag");
        if (!etag) return reject(new Error("Storage did not expose the ETag header — configure bucket CORS (npm run storage:cors)"));
        resolve(etag);
      } else reject(Object.assign(new Error(`Part upload failed (${xhr.status})`), { status: xhr.status }));
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(blob);
  });
}

/**
 * Direct browser → private storage multipart upload. Files are split into
 * parts that upload in parallel with per-part retry; interrupted uploads
 * resume from the parts already stored. Nothing passes through the web server.
 */
export function Uploader({ projectId, onUploaded }: { projectId: string; onUploaded?: () => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [drag, setDrag] = useState(false);
  const controllers = useRef(new Map<string, AbortController>());
  const running = useRef(0);
  const queue = useRef<Item[]>([]);

  const patch = useCallback((id: string, p: Partial<Item>) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x))), []);

  const uploadOne = useCallback(
    async (item: Item) => {
      const ctrl = new AbortController();
      controllers.current.set(item.id, ctrl);
      const f = item.file;
      patch(item.id, { state: "uploading", error: undefined });
      try {
        let session: CreateRes | null = null;
        const done = new Map<number, string>();
        const saved = localStorage.getItem(resumeKey(projectId, f));
        if (saved) {
          try {
            const { mediaId } = JSON.parse(saved) as { mediaId: string };
            const res = await api<{ parts: { partNumber: number; etag: string; size: number }[]; partSize: number; partCount: number; uploadId: string }>(
              `/api/admin/uploads/${mediaId}/parts`,
            );
            session = { mediaId, uploadId: res.uploadId, partSize: res.partSize, partCount: res.partCount };
            for (const p of res.parts) {
              const expected = p.partNumber === res.partCount ? f.size - (res.partCount - 1) * res.partSize : res.partSize;
              if (p.size === expected) done.set(p.partNumber, p.etag);
            }
            patch(item.id, { resumed: done.size > 0 });
          } catch {
            localStorage.removeItem(resumeKey(projectId, f));
          }
        }
        if (!session) {
          session = await api<CreateRes>("/api/admin/uploads/create", {
            body: { projectId, filename: f.name, size: f.size, mimeType: f.type || undefined, lastModified: f.lastModified },
          });
          localStorage.setItem(resumeKey(projectId, f), JSON.stringify({ mediaId: session.mediaId }));
        }
        const { mediaId, partSize, partCount } = session;
        patch(item.id, { mediaId });

        const progress = new Map<number, number>();
        for (const n of done.keys()) progress.set(n, n === partCount ? f.size - (partCount - 1) * partSize : partSize);
        const report = () => patch(item.id, { loaded: [...progress.values()].reduce((a, b) => a + b, 0) });
        report();

        const pending = Array.from({ length: partCount }, (_, i) => i + 1).filter((n) => !done.has(n));
        const urls = new Map<number, string>();
        const sign = async (nums: number[]) => {
          for (let i = 0; i < nums.length; i += 100) {
            const res = await api<{ urls: Record<string, string> }>("/api/admin/uploads/sign-parts", { body: { mediaId, partNumbers: nums.slice(i, i + 100) } });
            for (const [k, v] of Object.entries(res.urls)) urls.set(Number(k), v);
          }
        };
        await sign(pending.slice(0, 100));

        let cursor = 0;
        const worker = async () => {
          while (cursor < pending.length) {
            const n = pending[cursor++]!;
            const start = (n - 1) * partSize;
            const blob = f.slice(start, Math.min(f.size, start + partSize));
            for (let attempt = 1; ; attempt++) {
              if (ctrl.signal.aborted) throw new DOMException("Aborted", "AbortError");
              try {
                if (!urls.has(n)) await sign(pending.slice(pending.indexOf(n), pending.indexOf(n) + 100));
                const etag = await putPart(urls.get(n)!, blob, (l) => {
                  progress.set(n, l);
                  report();
                }, ctrl.signal);
                done.set(n, etag);
                progress.set(n, blob.size);
                report();
                break;
              } catch (err) {
                if ((err as Error).name === "AbortError") throw err;
                if (attempt >= MAX_PART_RETRIES) throw err;
                if ((err as { status?: number }).status === 403) urls.delete(n); // signed URL expired → re-sign
                progress.set(n, 0);
                await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
              }
            }
          }
        };
        await Promise.all(Array.from({ length: Math.min(PART_CONCURRENCY, pending.length || 1) }, worker));

        patch(item.id, { state: "completing" });
        await api("/api/admin/uploads/complete", {
          body: { mediaId, parts: [...done.entries()].sort((a, b) => a[0] - b[0]).map(([partNumber, etag]) => ({ partNumber, etag })) },
        });
        localStorage.removeItem(resumeKey(projectId, f));
        patch(item.id, { state: "done", loaded: f.size });
        onUploaded?.();
      } catch (err) {
        if ((err as Error).name === "AbortError") patch(item.id, { state: "cancelled" });
        else patch(item.id, { state: "error", error: err instanceof ApiError || err instanceof Error ? err.message : "Upload failed" });
      } finally {
        controllers.current.delete(item.id);
      }
    },
    [onUploaded, patch, projectId],
  );

  const pump = useCallback(() => {
    while (running.current < FILE_CONCURRENCY && queue.current.length) {
      const next = queue.current.shift()!;
      running.current++;
      void uploadOne(next).finally(() => {
        running.current--;
        pump();
      });
    }
  }, [uploadOne]);

  const add = (files: FileList | File[]) => {
    const next = [...files].map((file) => ({ id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`, file, state: "queued" as const, loaded: 0 }));
    setItems((xs) => [...next, ...xs]);
    queue.current.push(...next);
    pump();
  };

  const retry = (item: Item) => {
    patch(item.id, { state: "queued", error: undefined });
    queue.current.push(item);
    pump();
  };

  const cancel = async (item: Item) => {
    controllers.current.get(item.id)?.abort();
    queue.current = queue.current.filter((q) => q.id !== item.id);
    if (item.mediaId && item.state !== "done") {
      await api("/api/admin/uploads/abort", { body: { mediaId: item.mediaId } }).catch(() => undefined);
      localStorage.removeItem(resumeKey(projectId, item.file));
    }
    patch(item.id, { state: "cancelled" });
  };

  return (
    <div className="space-y-3">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          add(e.dataTransfer.files);
        }}
        className={cx(
          "flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 py-8 text-center transition-colors",
          drag ? "border-ocean-400 bg-ocean-400/5" : "border-ink-600 hover:border-ink-500",
        )}
      >
        <input
          type="file"
          multiple
          accept={ACCEPT}
          className="sr-only"
          onChange={(e) => {
            const files = e.target.files ? Array.from(e.target.files) : [];
            e.target.value = ""; // allow re-selecting the same file (e.g. after a cancel)
            if (files.length) add(files);
          }}
        />
        <span className="text-sm text-mist-200">Drop originals here or click to browse</span>
        <span className="mt-1 text-xs text-mist-400">NEF · DNG · CR2 · CR3 · ARW · RAF · ORF · RW2 · JPG · PNG · TIFF · WEBP · MP4 · MOV · M4V · AVI · MKV — multi-GB files supported</span>
        <span className="mt-1 text-xs text-mist-400">Originals are stored exactly as uploaded and are never modified.</span>
      </label>
      {items.length > 0 && (
        <ul className="divide-y divide-ink-700 rounded-xl border border-ink-700 bg-ink-850" aria-live="polite">
          {items.map((it) => (
            <li key={it.id} className="grid grid-cols-[1fr_280px_auto] items-center gap-4 px-4 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="truncate">{it.file.name}</p>
                <p className="text-xs text-mist-400">
                  {formatBytes(it.file.size)}
                  {it.resumed && " · resumed"}
                  {it.state === "completing" && " · verifying"}
                  {it.state === "done" && " · uploaded — ingesting (checksum, metadata, previews)"}
                  {it.state === "cancelled" && " · cancelled"}
                  {it.error && <span className="text-coral-400"> · {it.error}</span>}
                </p>
              </div>
              <Progress value={Math.round((it.loaded / Math.max(1, it.file.size)) * 100)} label={`Upload ${it.file.name}`} />
              <div className="flex justify-end gap-1">
                {(it.state === "uploading" || it.state === "queued") && (
                  <Button size="sm" variant="ghost" onClick={() => cancel(it)}>
                    Cancel
                  </Button>
                )}
                {it.state === "error" && (
                  <Button size="sm" onClick={() => retry(it)}>
                    Retry
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
