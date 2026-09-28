"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, cx, EmptyState, PageHeader, QualityLabel, Select, StatusBadge } from "@/components/ui";
import { LocalTime } from "@/components/ui/LocalTime";
import { api, ApiError } from "@/lib/client-api";
import { formatBytes } from "@/lib/labels";
import type { MediaView, VersionView } from "@/server/views";
import { DeliveryCreator } from "./DeliveryCreator";
import { Uploader } from "./Uploader";

type Tab = "photos" | "videos" | "raw" | "ai" | "color" | "deliveries";

interface Props {
  project: { id: string; name: string; status: string; description: string | null; shootDate: string | null; client: { id: string; name: string } | null };
  media: MediaView[];
  clients: { id: string; name: string }[];
  deliveries: { id: string; number: number; title: string; client: string; createdAt: string; expiresAt: string; status: string; files: number; downloads: number; favorites: number }[];
}

export function ProjectWorkspace({ project, media, clients, deliveries }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("photos");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deliveryOpen, setDeliveryOpen] = useState(false);

  // keep the grid fresh while files are ingesting
  const pending = media.some((m) => m.status !== "READY" && m.status !== "FAILED");
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(t);
  }, [pending, router]);

  const photos = media.filter((m) => m.mediaType === "PHOTO");
  const raws = media.filter((m) => m.mediaType === "RAW");
  const videos = media.filter((m) => m.mediaType === "VIDEO");
  const allVersions = useMemo(() => media.flatMap((m) => m.versions.map((v) => ({ v, m }))), [media]);
  const aiVersions = allVersions.filter(({ v }) => v.category === "ENHANCED" || v.category === "ENHANCED_COLOR" || v.category === "RAW_DEVELOPED");
  const colorVersions = allVersions.filter(({ v }) => v.category === "COLOR_GRADED" || v.category === "ENHANCED_COLOR");

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const publish = async (published: boolean) => {
    setBusy(true);
    setError(null);
    try {
      for (const id of selected) await api(`/api/admin/versions/${id}/publish`, { body: { published } });
      setSelected(new Set());
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "photos", label: "Photos", count: photos.length },
    { id: "videos", label: "Videos", count: videos.length },
    { id: "raw", label: "RAW", count: raws.length },
    { id: "ai", label: "AI Versions", count: aiVersions.length },
    { id: "color", label: "Color Grades", count: colorVersions.length },
    { id: "deliveries", label: "Deliveries", count: deliveries.length },
  ];

  return (
    <>
      <PageHeader eyebrow="Project" title={project.name}>
        <Select
          aria-label="Project status"
          className="w-40"
          defaultValue={project.status}
          onChange={async (e) => {
            await api(`/api/admin/projects/${project.id}`, { method: "PATCH", body: { status: e.target.value } });
            router.refresh();
          }}
        >
          {["DRAFT", "PROCESSING", "READY", "ACTIVE", "ARCHIVED"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
        <Button variant="primary" onClick={() => setDeliveryOpen(true)} disabled={!allVersions.some(({ v }) => v.published)}>
          Create client delivery
        </Button>
      </PageHeader>

      <dl className="mb-6 grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
        <div>
          <dt className="eyebrow">Client</dt>
          <dd className="mt-1 text-mist-200">{project.client?.name ?? "—"}</dd>
        </div>
        <div>
          <dt className="eyebrow">Date</dt>
          <dd className="mt-1 text-mist-200">{project.shootDate ? <LocalTime iso={project.shootDate} /> : "—"}</dd>
        </div>
        <div>
          <dt className="eyebrow">Masters</dt>
          <dd className="tabular mt-1 text-mist-200">
            {media.length} · {formatBytes(media.reduce((a, m) => a + m.size, 0))}
          </dd>
        </div>
        <div>
          <dt className="eyebrow">Published versions</dt>
          <dd className="tabular mt-1 text-mist-200">{allVersions.filter(({ v }) => v.published).length}</dd>
        </div>
      </dl>

      <div className="mb-6">
        <Uploader projectId={project.id} onUploaded={() => router.refresh()} />
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-ink-700">
        <div role="tablist" aria-label="Project content" className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => {
                setTab(t.id);
                setSelected(new Set());
              }}
              className={cx("-mb-px border-b-2 px-3 pb-3 text-sm", tab === t.id ? "border-ocean-400 text-mist-100" : "border-transparent text-mist-400 hover:text-mist-200")}
            >
              {t.label} <span className="tabular ml-1 text-xs text-mist-400">{t.count}</span>
            </button>
          ))}
        </div>
        {selected.size > 0 && (
          <div className="flex items-center gap-2 pb-2">
            <span className="text-xs text-mist-400">{selected.size} selected</span>
            <Button size="sm" onClick={() => publish(true)} loading={busy}>
              Publish to client
            </Button>
            <Button size="sm" variant="ghost" onClick={() => publish(false)} disabled={busy}>
              Unpublish
            </Button>
          </div>
        )}
      </div>
      {error && (
        <div className="mb-4">
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      {(tab === "photos" || tab === "videos" || tab === "raw") && (
        <MediaGrid items={tab === "photos" ? photos : tab === "videos" ? videos : raws} selected={selected} onToggle={toggle} />
      )}
      {(tab === "ai" || tab === "color") && <VersionGrid items={tab === "ai" ? aiVersions : colorVersions} selected={selected} onToggle={toggle} />}
      {tab === "deliveries" && (
        <Card padded={false}>
          {deliveries.length === 0 ? (
            <div className="p-5">
              <EmptyState title="No deliveries yet">Publish versions, then create a private 48-hour client delivery.</EmptyState>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-mist-400">
                <tr className="border-b border-ink-700">
                  <th className="px-5 py-3 font-medium">Delivery</th>
                  <th className="px-5 py-3 font-medium">Client</th>
                  <th className="px-5 py-3 font-medium">Created</th>
                  <th className="px-5 py-3 font-medium">Expires</th>
                  <th className="px-5 py-3 font-medium">Files</th>
                  <th className="px-5 py-3 font-medium">Downloads</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700">
                {deliveries.map((d) => (
                  <tr key={d.id}>
                    <td className="px-5 py-3">
                      <Link className="hover:text-ocean-300" href={`/admin/deliveries/${d.id}`}>
                        #{String(d.number).padStart(3, "0")} · {d.title}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-mist-300">{d.client}</td>
                    <td className="px-5 py-3 text-mist-300">
                      <LocalTime iso={d.createdAt} />
                    </td>
                    <td className="px-5 py-3 text-mist-300">
                      <LocalTime iso={d.expiresAt} />
                    </td>
                    <td className="tabular px-5 py-3">{d.files}</td>
                    <td className="tabular px-5 py-3">{d.downloads}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={d.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      <DeliveryCreator open={deliveryOpen} onClose={() => setDeliveryOpen(false)} projectId={project.id} projectName={project.name} defaultClientId={project.client?.id ?? ""} clients={clients} media={media} />
    </>
  );
}

function MediaGrid({ items, selected, onToggle }: { items: MediaView[]; selected: Set<string>; onToggle: (id: string) => void }) {
  if (items.length === 0) return <EmptyState title="Nothing here yet">Upload originals above — they are stored untouched as permanent masters.</EmptyState>;
  return (
    <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6">
      {items.map((m) => {
        const original = m.versions.find((v) => v.isMasterRef);
        const published = m.versions.filter((v) => v.published).length;
        return (
          <li key={m.id} className="group overflow-hidden rounded-xl border border-ink-700 bg-ink-850">
            <div className="relative aspect-[4/3] bg-ink-800">
              {m.thumbUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.thumbUrl} alt={m.filename} loading="lazy" className="size-full object-cover" />
              ) : (
                <div className="grid size-full place-items-center text-xs text-mist-400">{m.status === "FAILED" ? "Failed" : "Processing…"}</div>
              )}
              {original && (
                <label className="absolute left-2 top-2 flex items-center gap-1.5 rounded-md bg-black/60 px-1.5 py-1 text-[10px] text-mist-100 backdrop-blur">
                  <input type="checkbox" checked={selected.has(original.id)} onChange={() => onToggle(original.id)} aria-label={`Select original ${m.filename}`} />
                  ORIGINAL
                </label>
              )}
              {m.favorites > 0 && <span className="absolute right-2 top-2 rounded-md bg-black/60 px-1.5 py-1 text-[10px] text-sand-400">♥ {m.favorites}</span>}
            </div>
            <Link href={`/admin/media/${m.id}`} className="block px-3 py-2.5 hover:bg-ink-800">
              <p className="truncate text-sm">{m.filename}</p>
              <div className="mt-1 flex items-center justify-between text-[11px] text-mist-400">
                <span>
                  {m.width && m.height ? `${m.width}×${m.height}` : m.mediaType} · {formatBytes(m.size)}
                </span>
                {m.status === "READY" ? <span>{m.versions.length} v · {published} pub</span> : <StatusBadge status={m.status} />}
              </div>
              {m.errorMessage && <p className="mt-1 truncate text-[11px] text-coral-400">{m.errorMessage}</p>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function VersionGrid({ items, selected, onToggle }: { items: { v: VersionView; m: MediaView }[]; selected: Set<string>; onToggle: (id: string) => void }) {
  if (items.length === 0) return <EmptyState title="No versions yet">Process files in AI Photo, AI Video or Color Grade — every result is a new version.</EmptyState>;
  return (
    <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6">
      {items.map(({ v, m }) => (
        <li key={v.id} className={cx("overflow-hidden rounded-xl border bg-ink-850", selected.has(v.id) ? "border-ocean-400" : "border-ink-700")}>
          <label className="relative block aspect-[4/3] cursor-pointer bg-ink-800">
            {v.thumbUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={v.thumbUrl} alt={v.filename} loading="lazy" className="size-full object-cover" />
            )}
            <input type="checkbox" className="absolute left-2 top-2" checked={selected.has(v.id)} onChange={() => onToggle(v.id)} aria-label={`Select ${v.filename}`} />
            {v.published && <span className="absolute right-2 top-2 rounded bg-kelp-400/90 px-1.5 py-0.5 text-[10px] font-semibold text-ink-950">PUBLISHED</span>}
          </label>
          <Link href={`/admin/media/${m.id}`} className="block space-y-1 px-3 py-2.5 hover:bg-ink-800">
            <QualityLabel label={v.label} ai={v.isAi} />
            <p className="truncate text-xs text-mist-300">{v.filename}</p>
            <p className="text-[11px] text-mist-400">
              v{v.versionNumber} · {v.width}×{v.height} · {formatBytes(v.size)}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
