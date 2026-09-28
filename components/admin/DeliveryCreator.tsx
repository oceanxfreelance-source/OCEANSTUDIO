"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Alert, Button, CopyButton, Field, Input, Modal, QualityLabel, Select, Toggle } from "@/components/ui";
import { api, ApiError } from "@/lib/client-api";
import { formatBytes } from "@/lib/labels";
import type { MediaView, VersionView } from "@/server/views";

const PRESETS: { id: VersionView["category"] | "ENHANCED_ANY"; label: string }[] = [
  { id: "ORIGINAL", label: "Original" },
  { id: "ENHANCED", label: "Enhanced" },
  { id: "COLOR_GRADED", label: "Color Graded" },
  { id: "ENHANCED_COLOR", label: "Enhanced + Color Graded" },
  { id: "ORIGINAL_RAW", label: "Original RAW" },
];

/**
 * Pick the EXACT published version per file. Quick-select buttons choose the
 * newest published version of a category for every file; each file can then be
 * overridden individually. Only published versions are listed.
 */
export function DeliveryCreator({
  open,
  onClose,
  projectId,
  projectName,
  defaultClientId,
  clients,
  media,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  defaultClientId: string;
  clients: { id: string; name: string }[];
  media: MediaView[];
}) {
  const router = useRouter();
  const candidates = useMemo(() => media.map((m) => ({ m, published: m.versions.filter((v) => v.published) })).filter((x) => x.published.length > 0), [media]);
  const [choice, setChoice] = useState<Record<string, string>>(() =>
    Object.fromEntries(candidates.map(({ m, published }) => [m.id, published[published.length - 1]!.id])),
  );
  const [clientId, setClientId] = useState(defaultClientId);
  const [title, setTitle] = useState(projectName);
  const [allowFavorites, setAllowFavorites] = useState(true);
  const [watermark, setWatermark] = useState(false);
  const [buildZip, setBuildZip] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ link: string; password: string; expiresAt: string; deliveryId: string } | null>(null);

  const applyPreset = (cat: string) =>
    setChoice(
      Object.fromEntries(
        candidates.map(({ m, published }) => {
          const match = [...published].reverse().find((v) => v.category === cat);
          return [m.id, match?.id ?? ""];
        }),
      ),
    );

  const chosen = Object.values(choice).filter(Boolean);
  const totalBytes = candidates.reduce((a, { m, published }) => a + (published.find((v) => v.id === choice[m.id])?.size ?? 0), 0);

  return (
    <Modal open={open} onClose={() => { setResult(null); onClose(); }} title={result ? "Delivery created" : "Create 48-hour client delivery"} wide>
      {result ? (
        <div className="space-y-5">
          <Alert tone="success" title="Private gallery ready to share">
            The gallery is being prepared and expires exactly 48 hours after creation ({new Date(result.expiresAt).toLocaleString()}). Share the link and password separately.
          </Alert>
          <div className="space-y-3 rounded-xl border border-ink-700 bg-ink-900 p-4 font-mono text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="truncate">{result.link}</span>
              <CopyButton label="Copy link" getValue={() => result.link} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>{result.password}</span>
              <CopyButton label="Copy password" getValue={() => result.password} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button onClick={() => router.push(`/admin/deliveries/${result.deliveryId}`)}>View delivery</Button>
            <Button variant="primary" onClick={() => { setResult(null); onClose(); router.refresh(); }}>
              Done
            </Button>
          </div>
        </div>
      ) : candidates.length === 0 ? (
        <Alert tone="warn">No published versions yet. Select versions in the project and choose “Publish to client” first — clients only ever receive what you publish.</Alert>
      ) : (
        <form
          className="space-y-6"
          onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            setError(null);
            try {
              const res = await api<{ link: string; password: string; expiresAt: string; deliveryId: string }>("/api/admin/deliveries", {
                body: { projectId, clientId, title, versionIds: chosen, allowFavorites, watermarkPreviews: watermark, buildZip },
              });
              setResult(res);
            } catch (err) {
              setError(err instanceof ApiError ? err.message : "Could not create delivery");
            } finally {
              setLoading(false);
            }
          }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Client" htmlFor="dclient">
              <Select id="dclient" required value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">Select client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Gallery title" htmlFor="dtitle">
              <Input id="dtitle" required maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
          </div>

          <div>
            <p className="eyebrow mb-2">Deliver for every file</p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <Button key={p.id} type="button" size="sm" onClick={() => applyPreset(p.id)}>
                  {p.label}
                </Button>
              ))}
            </div>
          </div>

          <ul className="max-h-80 divide-y divide-ink-700 overflow-y-auto rounded-xl border border-ink-700">
            {candidates.map(({ m, published }) => {
              const v = published.find((x) => x.id === choice[m.id]);
              return (
                <li key={m.id} className="grid grid-cols-[48px_1fr_280px] items-center gap-3 px-3 py-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {v?.thumbUrl ? <img src={v.thumbUrl} alt="" className="size-12 rounded object-cover" /> : <div className="size-12 rounded bg-ink-800" />}
                  <div className="min-w-0">
                    <p className="truncate text-sm">{m.filename}</p>
                    {v ? (
                      <p className="mt-0.5 flex items-center gap-2 text-xs text-mist-400">
                        <QualityLabel label={v.label} ai={v.isAi} /> {v.filename} · {formatBytes(v.size)}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-xs text-mist-400">Not included</p>
                    )}
                  </div>
                  <Select aria-label={`Version for ${m.filename}`} value={choice[m.id] ?? ""} onChange={(e) => setChoice({ ...choice, [m.id]: e.target.value })}>
                    <option value="">Exclude</option>
                    {published.map((pv) => (
                      <option key={pv.id} value={pv.id}>
                        v{pv.versionNumber} · {pv.label}
                      </option>
                    ))}
                  </Select>
                </li>
              );
            })}
          </ul>

          <div className="grid gap-4 md:grid-cols-3">
            <Toggle label="Client favorites" checked={allowFavorites} onChange={setAllowFavorites} />
            <Toggle label="Watermark previews" description="Browser previews only; downloads stay clean." checked={watermark} onChange={setWatermark} />
            <Toggle label="Build ZIP package" description="Temporary; deleted at expiry." checked={buildZip} onChange={setBuildZip} />
          </div>

          <Alert>
            Original files are delivered without resizing or unnecessary compression. Enhanced files are delivered in the exact final format selected by the photographer. {chosen.length} file(s) · {formatBytes(totalBytes)}.
          </Alert>
          {error && <Alert tone="error">{error}</Alert>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={loading} disabled={!clientId || chosen.length === 0}>
              Create 48-hour delivery
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
