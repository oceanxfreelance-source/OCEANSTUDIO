"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, cx, Progress, QualityLabel, Select, StatusBadge } from "@/components/ui";
import { LocalTime } from "@/components/ui/LocalTime";
import { api, ApiError } from "@/lib/client-api";
import { formatBytes, formatDuration } from "@/lib/labels";
import type { MediaView, VersionView } from "@/server/views";
import { CompareViewer, type FaceBox } from "./CompareViewer";
import { ColorPanel, EnhancePanel, RawPanel, VideoPanel, type Capabilities, type SourceInfo } from "./ProcessingPanels";

export interface MediaDetail extends MediaView {
  project: { id: string; name: string };
  metadata: { cameraMake: string | null; cameraModel: string | null; lens: string | null; iso: number | null; shutter: string | null; aperture: number | null; focalLength: number | null } | null;
  faces: FaceBox[];
  jobs: { id: string; jobType: string; status: string; progress: number; stage: string | null; errorMessage: string | null; createdAt: string }[];
}

type PanelTab = "enhance" | "raw" | "color" | "video";

export function MediaWorkspace({ media, caps, initialTab }: { media: MediaDetail; caps: Capabilities; initialTab?: PanelTab }) {
  const router = useRouter();
  const versions = media.versions;
  const original = versions.find((v) => v.isMasterRef) ?? versions[0];
  const latest = versions[versions.length - 1];
  const [beforeId, setBeforeId] = useState(original?.id ?? "");
  const [afterId, setAfterId] = useState(latest?.id ?? "");
  const [sourceId, setSourceId] = useState(original?.id ?? "");
  const tabs: PanelTab[] = media.mediaType === "VIDEO" ? ["video"] : media.mediaType === "RAW" ? ["raw", "enhance", "color"] : ["enhance", "color"];
  const [tab, setTab] = useState<PanelTab>(initialTab && tabs.includes(initialTab) ? initialTab : tabs[0]!);
  const [error, setError] = useState<string | null>(null);

  const active = media.jobs.some((j) => j.status === "QUEUED" || j.status === "PROCESSING") || media.status !== "READY";
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => router.refresh(), 2500);
    return () => clearInterval(t);
  }, [active, router]);
  // jump the "after" pane to a newly created version
  useEffect(() => {
    if (latest && !versions.some((v) => v.id === afterId)) setAfterId(latest.id);
  }, [latest, versions, afterId]);
  const lastCount = useMemo(() => versions.length, [versions.length]);
  useEffect(() => {
    if (latest) setAfterId(latest.id);
  }, [lastCount]); // eslint-disable-line react-hooks/exhaustive-deps

  const before = versions.find((v) => v.id === beforeId) ?? original;
  const after = versions.find((v) => v.id === afterId) ?? latest;
  const src = versions.find((v) => v.id === sourceId) ?? original;
  if (!original || !before || !after || !src) {
    return <Alert>{media.status === "FAILED" ? media.errorMessage ?? "Ingest failed." : "This file is still being ingested (checksum, metadata, previews)…"}</Alert>;
  }
  const source: SourceInfo = {
    versionId: src.id,
    label: src.label,
    filename: src.filename,
    width: src.width,
    height: src.height,
    isRawMaster: media.mediaType === "RAW" && src.isMasterRef,
  };

  const act = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed");
    }
  };

  const download = async (v: VersionView) =>
    act(async () => {
      const { url } = await api<{ url: string }>(`/api/admin/versions/${v.id}/download`, { method: "POST", body: {} });
      window.location.assign(url);
    });

  const toImg = (v: VersionView) => ({ label: v.label, isAi: v.isAi, width: v.width, height: v.height, previewUrl: v.previewUrl, detailUrl: v.detailUrl, filename: v.filename });

  return (
    <div className="grid gap-6 2xl:grid-cols-[1fr_400px] xl:grid-cols-[1fr_360px]">
      <div className="min-w-0 space-y-6">
        {error && <Alert tone="error">{error}</Alert>}
        <Card
          title={media.mediaType === "VIDEO" ? "Player" : "Original vs enhanced"}
          action={
            <div className="flex items-center gap-2 text-xs">
              <Select aria-label="Before version" className="h-8 w-56 text-xs" value={before.id} onChange={(e) => setBeforeId(e.target.value)}>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.versionNumber} · {v.label}
                  </option>
                ))}
              </Select>
              <span className="text-mist-400">vs</span>
              <Select aria-label="After version" className="h-8 w-56 text-xs" value={after.id} onChange={(e) => setAfterId(e.target.value)}>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.versionNumber} · {v.label}
                  </option>
                ))}
              </Select>
            </div>
          }
        >
          {media.mediaType === "VIDEO" ? (
            <div className="grid gap-3 md:grid-cols-2">
              {[before, after].map((v) => (
                <figure key={v.id} className="space-y-2">
                  <video src={v.previewUrl ?? undefined} controls playsInline preload="metadata" className="aspect-video w-full rounded-lg bg-black" />
                  <figcaption className="flex items-center gap-2 text-xs text-mist-400">
                    <QualityLabel label={v.label} ai={v.isAi} /> {v.width}×{v.height} · {v.fps ?? "?"} fps · {formatDuration(v.duration)} · proxy preview
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <CompareViewer before={toImg(before)} after={toImg(after)} faces={media.faces} />
          )}
        </Card>

        <Card title="Version history" padded={false}>
          <ol className="divide-y divide-ink-700">
            {[...versions].reverse().map((v) => {
              const fid = Array.isArray(v.fidelity) ? (v.fidelity as { passed: boolean; globalSsim: number }[]) : [];
              const warnings = ((v.settings as { warnings?: string[] } | null)?.warnings ?? []) as string[];
              return (
                <li key={v.id} className={cx("grid grid-cols-[64px_1fr_auto] items-center gap-4 px-5 py-3", v.id === after.id && "bg-ink-800/60")}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {v.thumbUrl ? <img src={v.thumbUrl} alt="" className="h-12 w-16 rounded object-cover" /> : <div className="h-12 w-16 rounded bg-ink-800" />}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="tabular text-xs text-mist-400">v{v.versionNumber}</span>
                      <QualityLabel label={v.isMasterRef ? "MASTER · " + v.label : v.label} ai={v.isAi} />
                      {v.published && <span className="text-[10px] font-semibold tracking-wider text-kelp-400">PUBLISHED</span>}
                    </div>
                    <p className="mt-1 truncate text-xs text-mist-300">
                      {v.filename} · {v.width}×{v.height} · {formatBytes(v.size)} · <LocalTime iso={v.createdAt} />
                    </p>
                    <p className="truncate text-[11px] text-mist-400">
                      {v.engine ? `engine: ${v.engine}` : "untouched upload"}
                      {fid.length > 0 && ` · fidelity ${fid.every((f) => f.passed) ? "passed" : "warnings"} (min SSIM ${Math.min(...fid.map((f) => f.globalSsim)).toFixed(3)})`}
                      {v.checksum && ` · sha256 ${v.checksum.slice(0, 12)}…`}
                    </p>
                    {warnings.map((w) => (
                      <p key={w} className="text-[11px] text-sand-400">
                        {w}
                      </p>
                    ))}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setAfterId(v.id)}>
                      View
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setSourceId(v.id)} disabled={v.id === src.id} title="Use as the source for the next processing step">
                      {v.id === src.id ? "Source" : "Use"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => download(v)}>
                      Download
                    </Button>
                    <Button size="sm" variant={v.published ? "secondary" : "primary"} onClick={() => act(() => api(`/api/admin/versions/${v.id}/publish`, { body: { published: !v.published } }))}>
                      {v.published ? "Unpublish" : "Publish to client"}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>
      </div>

      <div className="space-y-6">
        <Card title="Processing source">
          <Select aria-label="Processing source version" value={src.id} onChange={(e) => setSourceId(e.target.value)}>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                v{v.versionNumber} · {v.label}
              </option>
            ))}
          </Select>
          <p className="mt-2 text-xs text-mist-400">Every operation creates a new version. The master is never overwritten.</p>
        </Card>
        {tabs.length > 1 && (
          <div role="tablist" className="flex gap-1 rounded-lg border border-ink-700 bg-ink-850 p-1">
            {tabs.map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cx("flex-1 rounded-md px-3 py-1.5 text-xs font-medium", tab === t ? "bg-ink-700 text-mist-100" : "text-mist-400 hover:text-mist-200")}>
                {{ raw: "RAW", enhance: "AI Photo", color: "Color", video: "Video" }[t]}
              </button>
            ))}
          </div>
        )}
        {tab === "raw" && (source.isRawMaster ? <RawPanel source={source} onQueued={() => router.refresh()} /> : <Alert>Select the RAW master as the source to develop.</Alert>)}
        {tab === "enhance" && <EnhancePanel source={source} caps={caps} onQueued={() => router.refresh()} />}
        {tab === "color" && <ColorPanel source={source} onQueued={() => router.refresh()} />}
        {tab === "video" && <VideoPanel source={source} caps={caps} onQueued={() => router.refresh()} />}

        <Card title="Jobs">
          {media.jobs.length === 0 ? (
            <p className="text-sm text-mist-400">No jobs yet.</p>
          ) : (
            <ul className="space-y-3">
              {media.jobs.map((j) => (
                <li key={j.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span>{j.jobType.replace("_", " ")}</span>
                    <StatusBadge status={j.status} />
                  </div>
                  {(j.status === "PROCESSING" || j.status === "QUEUED") && <Progress value={j.progress} label={j.stage ?? j.jobType} />}
                  {j.stage && j.status === "PROCESSING" && <p className="text-[11px] text-mist-400">{j.stage}</p>}
                  {j.errorMessage && (
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[11px] text-coral-400">{j.errorMessage}</p>
                      <Button size="sm" onClick={() => act(() => api(`/api/admin/jobs/${j.id}/retry`, { method: "POST", body: {} }))}>
                        Retry
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Master integrity">
          <dl className="space-y-2 text-xs">
            <div className="flex justify-between gap-3">
              <dt className="text-mist-400">Status</dt>
              <dd>
                <StatusBadge status={media.integrityStatus} />
              </dd>
            </div>
            <div>
              <dt className="text-mist-400">SHA-256</dt>
              <dd className="mt-0.5 break-all font-mono text-[11px] text-mist-200">{media.checksum ?? "pending"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-mist-400">Last verified</dt>
              <dd>
                <LocalTime iso={media.integrityCheckedAt} />
              </dd>
            </div>
          </dl>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => act(() => api(`/api/admin/media/${media.id}/verify`, { method: "POST", body: {} }))}>
              Verify checksum
            </Button>
            <Button size="sm" variant="ghost" onClick={() => download(original)}>
              Download master
            </Button>
          </div>
        </Card>

        <Card title="Metadata">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            {[
              ["File", media.filename],
              ["Type", `${media.mediaType} · ${media.extension.toUpperCase()}`],
              ["Size", formatBytes(media.size)],
              ["Dimensions", media.width ? `${media.width}×${media.height}` : "—"],
              ...(media.mediaType === "VIDEO"
                ? [
                    ["Duration", formatDuration(media.duration)],
                    ["FPS", media.fps?.toString() ?? "—"],
                    ["Codec", media.codec ?? "—"],
                    ["Bitrate", media.bitrate ? `${(media.bitrate / 1e6).toFixed(1)} Mb/s` : "—"],
                    ["Audio", media.audioCodec ?? "—"],
                    ["Container", media.container ?? "—"],
                  ]
                : [
                    ["Camera", [media.metadata?.cameraMake, media.metadata?.cameraModel].filter(Boolean).join(" ") || "—"],
                    ["Lens", media.metadata?.lens ?? "—"],
                    ["ISO", media.metadata?.iso?.toString() ?? "—"],
                    ["Shutter", media.metadata?.shutter ?? "—"],
                    ["Aperture", media.metadata?.aperture ? `f/${media.metadata.aperture}` : "—"],
                    ["Focal length", media.metadata?.focalLength ? `${media.metadata.focalLength} mm` : "—"],
                  ]),
              ["Captured", media.capturedAt ? new Date(media.capturedAt).toUTCString().slice(5, 22) : "—"],
              ["Client favorites", String(media.favorites)],
            ].map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="text-mist-400">{k}</dt>
                <dd className="truncate text-mist-200">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
    </div>
  );
}
