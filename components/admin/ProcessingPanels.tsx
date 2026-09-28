"use client";

import { useState } from "react";
import { Alert, Button, Card, Field, Segmented, Select, Slider, Toggle } from "@/components/ui";
import { api, ApiError } from "@/lib/client-api";
import { formatBytes } from "@/lib/labels";
import {
  COLOR_PRESETS,
  estimateOutput,
  NEUTRAL_ADJUSTMENTS,
  type ColorAdjustments,
  type ColorPresetName,
  type OutputFormat,
  type QualityLevel,
  type RawDevelopSettings,
} from "@/lib/processing/settings";

export interface Capabilities {
  image: { provider: string; configured: boolean; isAi: boolean; denoise: boolean; deblur: boolean; focusRecovery: boolean; detailRecovery: boolean; sharpen: boolean; upscaleFactors: number[]; description: string };
  video: { provider: string; aiUpscale: boolean; deblur: boolean };
}

export interface SourceInfo {
  versionId: string;
  label: string;
  filename: string;
  width: number | null;
  height: number | null;
  isRawMaster: boolean;
}

async function submitPhoto(settings: Record<string, unknown>) {
  return api<{ job: { id: string } }>("/api/admin/process/photo", { body: { settings } });
}

function useSubmit(onQueued?: (jobId: string) => void) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queued, setQueued] = useState<string | null>(null);
  const run = async (fn: () => Promise<{ job: { id: string } }>) => {
    setLoading(true);
    setError(null);
    setQueued(null);
    try {
      const { job } = await fn();
      setQueued(job.id);
      onQueued?.(job.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not queue processing");
    } finally {
      setLoading(false);
    }
  };
  return { loading, error, queued, run };
}

function OutputPicker({ value, onChange }: { value: OutputFormat; onChange: (v: OutputFormat) => void }) {
  return (
    <Field label="Output format" htmlFor="outfmt" hint="New derivative only — the master is never overwritten.">
      <Select id="outfmt" value={value.format} onChange={(e) => onChange({ ...value, format: e.target.value as OutputFormat["format"] })}>
        <option value="tiff16">TIFF 16-bit (lossless, recommended)</option>
        <option value="tiff8">TIFF 8-bit (lossless)</option>
        <option value="png">PNG 16-bit (lossless)</option>
        <option value="jpeg">JPEG 4:4:4 (high quality)</option>
      </Select>
    </Field>
  );
}

// ---------------------------------------------------------------------------
// AI PHOTO
// ---------------------------------------------------------------------------
export function EnhancePanel({ source, caps, onQueued }: { source: SourceInfo; caps: Capabilities; onQueued?: (id: string) => void }) {
  const [tools, setTools] = useState({ autoEnhance: false, denoise: true, deblur: false, focusRecovery: false, detailRecovery: false, sharpen: false });
  const [upscale, setUpscale] = useState<1 | 2 | 4 | 8>(1);
  const [facePreservation, setFacePreservation] = useState(true);
  const [quality, setQuality] = useState<QualityLevel>("natural");
  const [output, setOutput] = useState<OutputFormat>({ format: "tiff16", jpegQuality: 98 });
  const [ack8, setAck8] = useState(false);
  const [ackMax, setAckMax] = useState(false);
  const s = useSubmit(onQueued);
  const c = caps.image;
  const est = source.width && source.height ? estimateOutput(source.width, source.height, upscale, output.format) : null;

  const TOOL_LIST: { key: keyof typeof tools; label: string; supported: boolean; hint: string }[] = [
    { key: "autoEnhance", label: "Auto Enhance", supported: true, hint: "Analyses exposure, range, noise and sharpness; applies conservative corrections." },
    { key: "denoise", label: "Noise Reduction", supported: c.denoise, hint: "High-ISO, colour and luminance noise." },
    { key: "deblur", label: "Motion Deblur", supported: c.deblur, hint: c.deblur ? "Attempts to recover motion-blurred subjects." : "Requires an AI provider (AI_IMAGE_PROVIDER=replicate)." },
    { key: "focusRecovery", label: "Focus Recovery", supported: c.focusRecovery, hint: "Improves slightly out-of-focus images." },
    { key: "detailRecovery", label: "Detail Recovery", supported: c.detailRecovery, hint: "Recovers visible detail without inventing texture." },
    { key: "sharpen", label: "Natural Sharpen", supported: c.sharpen, hint: "Controlled small-radius sharpening." },
  ];

  return (
    <Card title="AI tools" action={<span className="text-xs text-mist-400">{c.isAi ? `AI · ${c.provider}` : "Classical engine (non-AI)"}</span>}>
      <div className="space-y-6">
        {!c.configured && <Alert tone="error">The AI provider is selected but not configured (AI_IMAGE_API_KEY missing).</Alert>}
        {!c.isAi && <Alert>{c.description} Results are labelled ENHANCED, not AI ENHANCED.</Alert>}
        {source.isRawMaster && <Alert>This is a RAW master: it will be decoded and developed (default or your RAW settings) before enhancement.</Alert>}
        <div className="space-y-4">
          {TOOL_LIST.map((t) => (
            <Toggle key={t.key} label={t.label} description={t.hint} disabled={!t.supported} checked={tools[t.key] && t.supported} onChange={(v) => setTools({ ...tools, [t.key]: v })} />
          ))}
        </div>

        <div>
          <p className="eyebrow mb-2">Upscale</p>
          <Segmented
            label="Upscale factor"
            value={upscale}
            onChange={(v) => setUpscale(v)}
            options={[
              { value: 1, label: "1×" },
              { value: 2, label: "2×" },
              { value: 4, label: "4×" },
              { value: 8, label: "8×" },
            ]}
          />
          {est && upscale > 1 && (
            <p className="tabular mt-2 text-xs text-mist-400">
              {source.width}×{source.height} → {est.width.toLocaleString()}×{est.height.toLocaleString()} ({est.megapixels.toFixed(0)} MP, ≈{formatBytes(est.approxBytes)})
            </p>
          )}
          {upscale === 8 && (
            <div className="mt-3 space-y-2">
              <Alert tone="warn" title="8× creates extremely large files">
                8× multiplies pixel count by 64. Expect multi-gigabyte outputs, long processing and substantial storage. 8× is composed of {c.upscaleFactors.includes(4) ? "4× + 2×" : "2× + 2× + 2×"} passes.
              </Alert>
              <Toggle label="I understand — create the 8× derivative" checked={ack8} onChange={setAck8} />
            </div>
          )}
        </div>

        <div>
          <p className="eyebrow mb-2">Face preservation</p>
          <Toggle
            label={facePreservation ? "ON — restore, don't redesign" : "OFF"}
            description="Rejects any result that changes face shape, proportions or structure beyond the fidelity threshold; generative face restoration stays disabled."
            checked={facePreservation}
            onChange={setFacePreservation}
          />
        </div>

        <div>
          <p className="eyebrow mb-2">Quality</p>
          <Segmented
            label="Restoration strength"
            value={quality}
            onChange={setQuality}
            options={[
              { value: "natural", label: "Natural" },
              { value: "balanced", label: "Balanced" },
              { value: "maximum", label: "Maximum" },
            ]}
          />
          <p className="mt-2 text-xs text-mist-400">Natural prioritises fidelity. Balanced applies moderate restoration.</p>
          {(tools.deblur || tools.focusRecovery) && (
            <p className="mt-2 text-xs text-sand-400">
              Severe blur may contain information that was never captured. AI restoration can reconstruct plausible detail, but cannot guarantee the exact original detail.
            </p>
          )}
          {quality === "maximum" && (
            <div className="mt-3 space-y-2">
              <Alert tone="warn">Maximum applies the strongest restoration. It can reconstruct plausible — not guaranteed — detail. Review faces carefully.</Alert>
              <Toggle label="I understand the risks of Maximum" checked={ackMax} onChange={setAckMax} />
            </div>
          )}
        </div>

        <OutputPicker value={output} onChange={setOutput} />
        {s.error && <Alert tone="error">{s.error}</Alert>}
        {s.queued && <Alert tone="success">Queued. The result will appear as a new version.</Alert>}
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          loading={s.loading}
          disabled={(upscale === 8 && !ack8) || (quality === "maximum" && !ackMax) || !c.configured}
          onClick={() =>
            s.run(() =>
              submitPhoto({
                sourceVersionId: source.versionId,
                enhance: { ...tools, deblur: tools.deblur && c.deblur, upscale, facePreservation, quality },
                output,
                acknowledgeLargeOutput: ack8,
                acknowledgeMaximumQuality: ackMax,
              }),
            )
          }
        >
          Process
        </Button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// RAW EDITOR
// ---------------------------------------------------------------------------
const RAW_DEFAULTS: RawDevelopSettings = {
  exposure: 0,
  temperature: null,
  tint: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  contrast: 0,
  saturation: 0,
  vibrance: 0,
  clarity: 0,
  dehaze: 0,
  sharpness: 25,
  detail: 25,
  noiseReduction: 0,
  highlightRecovery: "blend",
};

export function RawPanel({ source, onQueued }: { source: SourceInfo; onQueued?: (id: string) => void }) {
  const [r, setR] = useState<RawDevelopSettings>(RAW_DEFAULTS);
  const [output, setOutput] = useState<OutputFormat>({ format: "tiff16", jpegQuality: 98 });
  const s = useSubmit(onQueued);
  const set = <K extends keyof RawDevelopSettings>(k: K, v: RawDevelopSettings[K]) => setR({ ...r, [k]: v });
  return (
    <Card title="RAW master" action={<span className="text-xs text-mist-400">LibRaw · 16-bit</span>}>
      <div className="space-y-5">
        <div className="rounded-lg bg-ink-900 px-4 py-3">
          <p className="font-mono text-sm">{source.filename}</p>
          <p className="tabular text-xs text-mist-400">
            {source.width}×{source.height} · adjustments are stored as settings; the RAW file is never modified
          </p>
        </div>
        <Slider label="Exposure" value={r.exposure} min={-5} max={5} step={0.05} onChange={(v) => set("exposure", v)} format={(v) => `${v > 0 ? "+" : ""}${v.toFixed(2)} EV`} />
        <div className="space-y-2">
          <Toggle label="As-shot white balance" checked={r.temperature === null} onChange={(v) => set("temperature", v ? null : 5500)} />
          {r.temperature !== null && <Slider label="Temperature" value={r.temperature} min={2000} max={12000} step={50} neutral={5500} onChange={(v) => set("temperature", v)} format={(v) => `${v} K`} />}
        </div>
        <Slider label="Tint" value={r.tint} min={-150} max={150} onChange={(v) => set("tint", v)} />
        {(["highlights", "shadows", "whites", "blacks", "contrast", "saturation", "vibrance", "clarity", "dehaze"] as const).map((k) => (
          <Slider key={k} label={k[0]!.toUpperCase() + k.slice(1)} value={r[k]} min={-100} max={100} onChange={(v) => set(k, v)} />
        ))}
        <Slider label="Sharpness" value={r.sharpness} min={0} max={150} neutral={25} onChange={(v) => set("sharpness", v)} />
        <Slider label="Detail" value={r.detail} min={0} max={100} neutral={25} onChange={(v) => set("detail", v)} />
        <Slider label="Noise Reduction" value={r.noiseReduction} min={0} max={100} onChange={(v) => set("noiseReduction", v)} />
        <Field label="Highlight recovery" htmlFor="hl">
          <Select id="hl" value={r.highlightRecovery} onChange={(e) => set("highlightRecovery", e.target.value as RawDevelopSettings["highlightRecovery"])}>
            <option value="clip">Clip</option>
            <option value="blend">Blend</option>
            <option value="rebuild">Rebuild</option>
          </Select>
        </Field>
        <OutputPicker value={output} onChange={setOutput} />
        {s.error && <Alert tone="error">{s.error}</Alert>}
        {s.queued && <Alert tone="success">Develop queued — a RAW DEVELOPED version will be created.</Alert>}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="primary" loading={s.loading} onClick={() => s.run(() => submitPhoto({ sourceVersionId: source.versionId, raw: r, output }))}>
            Develop RAW
          </Button>
          <Button
            loading={s.loading}
            onClick={() =>
              s.run(() =>
                submitPhoto({
                  sourceVersionId: source.versionId,
                  raw: r,
                  enhance: { autoEnhance: false, denoise: true, deblur: false, focusRecovery: false, detailRecovery: true, sharpen: false, upscale: 1, facePreservation: true, quality: "natural" },
                  output,
                }),
              )
            }
          >
            AI Enhance
          </Button>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setR(RAW_DEFAULTS)}>
          Reset
        </Button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// COLOR
// ---------------------------------------------------------------------------
export function ColorControls({
  preset,
  setPreset,
  intensity,
  setIntensity,
  adj,
  setAdj,
}: {
  preset: ColorPresetName | null;
  setPreset: (p: ColorPresetName | null) => void;
  intensity: number;
  setIntensity: (v: number) => void;
  adj: ColorAdjustments;
  setAdj: (a: ColorAdjustments) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow mb-2">Preset</p>
        <div className="grid grid-cols-2 gap-1.5">
          <button onClick={() => setPreset(null)} className={`rounded-lg border px-3 py-2 text-left text-xs ${preset === null ? "border-ocean-400 bg-ocean-400/10" : "border-ink-600 hover:border-ink-500"}`}>
            None
          </button>
          {COLOR_PRESETS.map((p) => (
            <button key={p} onClick={() => setPreset(p)} aria-pressed={preset === p} className={`rounded-lg border px-3 py-2 text-left text-xs ${preset === p ? "border-ocean-400 bg-ocean-400/10" : "border-ink-600 hover:border-ink-500"}`}>
              {p}
            </button>
          ))}
        </div>
      </div>
      {preset && <Slider label="Intensity" value={intensity} min={0} max={100} neutral={100} onChange={setIntensity} format={(v) => `${v}%`} />}
      <Slider label="Exposure" value={adj.exposure} min={-3} max={3} step={0.05} onChange={(v) => setAdj({ ...adj, exposure: v })} format={(v) => `${v > 0 ? "+" : ""}${v.toFixed(2)} EV`} />
      {(["contrast", "highlights", "shadows", "whites", "blacks", "temperature", "tint", "saturation", "vibrance", "clarity", "dehaze"] as const).map((k) => (
        <Slider key={k} label={k[0]!.toUpperCase() + k.slice(1)} value={adj[k]} min={-100} max={100} onChange={(v) => setAdj({ ...adj, [k]: v })} />
      ))}
      <Slider label="Sharpness" value={adj.sharpness} min={0} max={150} onChange={(v) => setAdj({ ...adj, sharpness: v })} />
    </div>
  );
}

export function ColorPanel({ source, onQueued }: { source: SourceInfo; onQueued?: (id: string) => void }) {
  const [preset, setPreset] = useState<ColorPresetName | null>("Natural");
  const [intensity, setIntensity] = useState(100);
  const [adj, setAdj] = useState<ColorAdjustments>(NEUTRAL_ADJUSTMENTS);
  const [output, setOutput] = useState<OutputFormat>({ format: "tiff16", jpegQuality: 98 });
  const s = useSubmit(onQueued);
  return (
    <Card title="Color grade">
      <div className="space-y-5">
        <ColorControls preset={preset} setPreset={setPreset} intensity={intensity} setIntensity={setIntensity} adj={adj} setAdj={setAdj} />
        <OutputPicker value={output} onChange={setOutput} />
        {s.error && <Alert tone="error">{s.error}</Alert>}
        {s.queued && <Alert tone="success">Queued — a new COLOR GRADED version will be created.</Alert>}
        <Button variant="primary" size="lg" className="w-full" loading={s.loading} onClick={() => s.run(() => submitPhoto({ sourceVersionId: source.versionId, color: { preset, intensity, adjustments: adj }, output }))}>
          Create graded version
        </Button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// VIDEO
// ---------------------------------------------------------------------------
export function VideoPanel({ source, caps, onQueued }: { source: SourceInfo; caps: Capabilities; onQueued?: (id: string) => void }) {
  const [o, setO] = useState({ aiUpscale: false, denoise: true, deblur: false, stabilization: false, sharpen: false, lowLight: false, colorCorrection: false });
  const [preset, setPreset] = useState<ColorPresetName | "">("");
  const [intensity, setIntensity] = useState(70);
  const [resolution, setResolution] = useState<"source" | "1080p" | "4k">("source");
  const [codec, setCodec] = useState<"h264" | "hevc" | "prores">("h264");
  const [quality, setQuality] = useState<QualityLevel>("natural");
  const s = useSubmit(onQueued);
  const list: { key: keyof typeof o; label: string; supported: boolean; hint?: string }[] = [
    { key: "aiUpscale", label: "AI Upscale", supported: caps.video.aiUpscale, hint: caps.video.aiUpscale ? "Real-ESRGAN video via Replicate" : "Requires AI_VIDEO_PROVIDER=replicate. Output resolution below uses Lanczos." },
    { key: "denoise", label: "Noise Reduction", supported: true, hint: "hqdn3d (Natural) / non-local means" },
    { key: "deblur", label: "Deblur", supported: caps.video.deblur, hint: "Not supported by the configured video provider." },
    { key: "stabilization", label: "Stabilization", supported: true, hint: "Two-pass vid.stab" },
    { key: "sharpen", label: "Sharpening", supported: true },
    { key: "lowLight", label: "Low-Light", supported: true },
    { key: "colorCorrection", label: "Color Correction", supported: true },
  ];
  return (
    <Card title="Video" action={<span className="text-xs text-mist-400">Runs in a background worker</span>}>
      <div className="space-y-5">
        {list.map((t) => (
          <Toggle key={t.key} label={t.label} description={t.hint} disabled={!t.supported} checked={o[t.key] && t.supported} onChange={(v) => setO({ ...o, [t.key]: v })} />
        ))}
        <Field label="Color grade" htmlFor="vgrade">
          <Select id="vgrade" value={preset} onChange={(e) => setPreset(e.target.value as ColorPresetName | "")}>
            <option value="">None</option>
            {COLOR_PRESETS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </Select>
        </Field>
        {preset && <Slider label="Intensity" value={intensity} min={0} max={100} neutral={100} onChange={setIntensity} format={(v) => `${v}%`} />}
        <div>
          <p className="eyebrow mb-2">Output</p>
          <Segmented label="Output resolution" value={resolution} onChange={setResolution} options={[{ value: "source", label: "Source" }, { value: "1080p", label: "1080p" }, { value: "4k", label: "4K" }]} />
        </div>
        <Field label="Codec" htmlFor="vcodec" hint="Frame rate, audio and color metadata are preserved.">
          <Select id="vcodec" value={codec} onChange={(e) => setCodec(e.target.value as typeof codec)}>
            <option value="h264">H.264 High (CRF 14)</option>
            <option value="hevc">HEVC 10-bit (CRF 16)</option>
            <option value="prores">ProRes 422 HQ (.mov)</option>
          </Select>
        </Field>
        <Segmented label="Quality" value={quality} onChange={setQuality} options={[{ value: "natural", label: "Natural" }, { value: "balanced", label: "Balanced" }, { value: "maximum", label: "Maximum" }]} />
        {s.error && <Alert tone="error">{s.error}</Alert>}
        {s.queued && <Alert tone="success">Queued — the enhanced video will appear as a new version.</Alert>}
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          loading={s.loading}
          onClick={() =>
            s.run(() =>
              api<{ job: { id: string } }>("/api/admin/process/video", {
                body: {
                  settings: {
                    sourceVersionId: source.versionId,
                    ...o,
                    aiUpscale: o.aiUpscale && caps.video.aiUpscale,
                    deblur: o.deblur && caps.video.deblur,
                    quality,
                    color: preset ? { preset, intensity, adjustments: {} } : undefined,
                    output: { resolution, codec },
                  },
                },
              }),
            )
          }
        >
          Process video
        </Button>
      </div>
    </Card>
  );
}
