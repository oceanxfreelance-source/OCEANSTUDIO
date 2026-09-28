"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert, Button, Card, EmptyState, Field, QualityLabel, Select } from "@/components/ui";
import { api, ApiError } from "@/lib/client-api";
import { NEUTRAL_ADJUSTMENTS, type ColorAdjustments, type ColorPresetName, type OutputFormat } from "@/lib/processing/settings";
import { ColorControls } from "./ProcessingPanels";

export interface BatchItem {
  mediaId: string;
  filename: string;
  versions: { id: string; label: string; versionNumber: number; thumbUrl: string | null; isAi: boolean }[];
}

/** Batch color grading: one new derivative per selected photo; originals untouched. */
export function BatchColor({ items }: { items: BatchItem[] }) {
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [preset, setPreset] = useState<ColorPresetName | null>("Ocean Blue");
  const [intensity, setIntensity] = useState(65);
  const [adj, setAdj] = useState<ColorAdjustments>(NEUTRAL_ADJUSTMENTS);
  const [output, setOutput] = useState<OutputFormat>({ format: "tiff16", jpegQuality: 98 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const count = Object.keys(selected).length;

  if (items.length === 0) return <EmptyState title="No photos in this project">Upload and ingest photos first.</EmptyState>;
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <Card
        title={`${count} of ${items.length} selected`}
        action={
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSelected(Object.fromEntries(items.map((i) => [i.mediaId, i.versions[i.versions.length - 1]!.id])))}>
              Select all (latest)
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected({})}>
              Clear
            </Button>
          </div>
        }
        padded={false}
      >
        <ul className="grid grid-cols-2 gap-3 p-4 md:grid-cols-3 2xl:grid-cols-5">
          {items.map((i) => {
            const vId = selected[i.mediaId];
            const v = i.versions.find((x) => x.id === (vId ?? i.versions[i.versions.length - 1]!.id))!;
            return (
              <li key={i.mediaId} className={`overflow-hidden rounded-lg border ${vId ? "border-ocean-400" : "border-ink-700"}`}>
                <label className="relative block cursor-pointer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {v.thumbUrl ? <img src={v.thumbUrl} alt="" className="aspect-[4/3] w-full object-cover" loading="lazy" /> : <div className="aspect-[4/3] bg-ink-800" />}
                  <input
                    type="checkbox"
                    className="absolute left-2 top-2"
                    checked={Boolean(vId)}
                    aria-label={`Select ${i.filename}`}
                    onChange={(e) =>
                      setSelected((s) => {
                        const n = { ...s };
                        if (e.target.checked) n[i.mediaId] = v.id;
                        else delete n[i.mediaId];
                        return n;
                      })
                    }
                  />
                </label>
                <div className="space-y-1.5 p-2">
                  <p className="truncate text-xs">{i.filename}</p>
                  <Select aria-label={`Source version for ${i.filename}`} className="h-7 text-[11px]" value={v.id} onChange={(e) => setSelected((s) => ({ ...s, [i.mediaId]: e.target.value }))}>
                    {i.versions.map((x) => (
                      <option key={x.id} value={x.id}>
                        v{x.versionNumber} · {x.label}
                      </option>
                    ))}
                  </Select>
                  <QualityLabel label={v.label} ai={v.isAi} />
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
      <Card title="Batch grade">
        <div className="space-y-5">
          <ColorControls preset={preset} setPreset={setPreset} intensity={intensity} setIntensity={setIntensity} adj={adj} setAdj={setAdj} />
          <Field label="Output format" htmlFor="bfmt">
            <Select id="bfmt" value={output.format} onChange={(e) => setOutput({ ...output, format: e.target.value as OutputFormat["format"] })}>
              <option value="tiff16">TIFF 16-bit</option>
              <option value="tiff8">TIFF 8-bit</option>
              <option value="png">PNG 16-bit</option>
              <option value="jpeg">JPEG 4:4:4</option>
            </Select>
          </Field>
          {error && <Alert tone="error">{error}</Alert>}
          {done !== null && (
            <Alert tone="success">
              {done} job(s) queued. Track them in the <Link href="/admin/processing" className="underline">processing center</Link>.
            </Alert>
          )}
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            disabled={count === 0}
            loading={loading}
            onClick={async () => {
              setLoading(true);
              setError(null);
              try {
                const res = await api<{ jobs: unknown[] }>("/api/admin/process/photo", {
                  body: { batch: true, versionIds: Object.values(selected), settings: { color: { preset, intensity, adjustments: adj }, output } },
                });
                setDone(res.jobs.length);
                setSelected({});
              } catch (err) {
                setError(err instanceof ApiError ? err.message : "Batch failed");
              } finally {
                setLoading(false);
              }
            }}
          >
            Create {count || ""} new derivative{count === 1 ? "" : "s"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
