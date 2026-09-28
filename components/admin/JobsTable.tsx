"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Alert, Button, cx, EmptyState, Modal, Progress, StatusBadge } from "@/components/ui";
import { LocalTime } from "@/components/ui/LocalTime";
import { api, ApiError } from "@/lib/client-api";

interface Job {
  id: string;
  jobType: string;
  status: string;
  progress: number;
  stage: string | null;
  errorMessage: string | null;
  technicalLog: string | null;
  createdAt: string;
  settings: Record<string, unknown> | null;
  attempts: number;
  media: { id: string; filename: string; mediaType: string } | null;
  delivery: { id: string; title: string } | null;
}

function describe(j: Job): string {
  const s = j.settings ?? {};
  const enhance = s.enhance as { upscale?: number; quality?: string } | undefined;
  const color = s.color as { preset?: string | null; intensity?: number } | undefined;
  const parts: string[] = [];
  if (j.jobType === "PHOTO_ENHANCE") parts.push(`${enhance?.upscale && enhance.upscale > 1 ? `${enhance.upscale}× ` : ""}Enhancement · ${enhance?.quality ?? ""}`);
  else if (j.jobType === "RAW_DEVELOP") parts.push("RAW develop");
  else if (j.jobType === "COLOR_GRADE") parts.push("Color grade");
  else if (j.jobType === "VIDEO_ENHANCE") parts.push(`Video → ${(s.output as { resolution?: string } | undefined)?.resolution ?? "source"}`);
  else parts.push(j.jobType.replace(/_/g, " ").toLowerCase());
  if (color?.preset) parts.push(`${color.preset} ${color.intensity ?? 100}%`);
  return parts.join(" · ");
}

export function JobsTable({ initialStatus }: { initialStatus?: string }) {
  const [status, setStatus] = useState(initialStatus ?? "");
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<Job | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api<{ jobs: Job[] }>(`/api/admin/jobs${status ? `?status=${status}` : ""}`);
      setJobs(res.jobs);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load jobs");
    }
  }, [status]);

  useEffect(() => {
    void load();
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [load]);

  const action = async (id: string, what: "retry" | "cancel") => {
    try {
      await api(`/api/admin/jobs/${id}/${what}`, { method: "POST", body: {} });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-1" role="tablist" aria-label="Job status filter">
        {["", "QUEUED", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED"].map((s) => (
          <button key={s} role="tab" aria-selected={status === s} onClick={() => setStatus(s)} className={cx("rounded-lg px-3 py-1.5 text-xs", status === s ? "bg-ink-750 text-mist-100" : "text-mist-400 hover:text-mist-200")}>
            {s || "All"}
          </button>
        ))}
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      {jobs === null ? (
        <p className="text-sm text-mist-400">Loading…</p>
      ) : jobs.length === 0 ? (
        <EmptyState title="No jobs" />
      ) : (
        <div className="overflow-hidden rounded-xl border border-ink-700">
          <table className="w-full text-sm">
            <thead className="bg-ink-850 text-left text-xs text-mist-400">
              <tr>
                <th className="px-4 py-3 font-medium">Job</th>
                <th className="px-4 py-3 font-medium">File</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="w-72 px-4 py-3 font-medium">Progress</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700">
              {jobs.map((j) => (
                <tr key={j.id} className="align-top">
                  <td className="px-4 py-3 font-mono text-[11px] text-mist-400">{j.id.slice(-8)}</td>
                  <td className="max-w-56 px-4 py-3">
                    {j.media ? (
                      <Link href={`/admin/media/${j.media.id}`} className="block truncate hover:text-ocean-300">
                        {j.media.filename}
                      </Link>
                    ) : j.delivery ? (
                      <Link href={`/admin/deliveries/${j.delivery.id}`} className="block truncate hover:text-ocean-300">
                        {j.delivery.title}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-mist-300">{describe(j)}</td>
                  <td className="px-4 py-3">
                    <Progress value={j.status === "COMPLETED" ? 100 : j.progress} label={`Job ${j.id}`} />
                    <p className="mt-1 truncate text-[11px] text-mist-400">{j.status === "FAILED" ? j.errorMessage : j.stage}</p>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={j.status} />
                    {j.attempts > 0 && <p className="mt-1 text-[10px] text-mist-400">retry #{j.attempts}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-mist-400">
                    <LocalTime iso={j.createdAt} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      {(j.status === "FAILED" || j.status === "CANCELLED") && (
                        <Button size="sm" onClick={() => action(j.id, "retry")}>
                          Retry
                        </Button>
                      )}
                      {(j.status === "QUEUED" || j.status === "PROCESSING") && (
                        <Button size="sm" variant="ghost" onClick={() => action(j.id, "cancel")}>
                          Cancel
                        </Button>
                      )}
                      {j.technicalLog && (
                        <Button size="sm" variant="ghost" onClick={() => setLog(j)}>
                          Log
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={Boolean(log)} onClose={() => setLog(null)} title="Technical log" wide>
        {log?.errorMessage && (
          <div className="mb-4">
            <Alert tone="error">{log.errorMessage}</Alert>
          </div>
        )}
        <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-lg bg-ink-950 p-4 font-mono text-[11px] leading-relaxed text-mist-300">{log?.technicalLog}</pre>
      </Modal>
    </div>
  );
}
