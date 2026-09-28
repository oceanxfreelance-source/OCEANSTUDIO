import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { env } from "@/lib/env";
import { ProcessingError } from "@/lib/errors";
import { img, sharp } from "../image/sharp";
import { ClassicalImageProvider } from "./classical";
import type { EnhancementStep, ImageEnhancementProvider, ProcessingInput, ProcessingResult, ProviderCapabilities } from "./types";

const API = "https://api.replicate.com/v1";
const TIFF16 = { compression: "none", bigtiff: true } as const;

type Fetch = typeof fetch;

export interface ReplicateClientOptions {
  apiKey: string;
  fetchImpl?: Fetch;
  pollIntervalMs?: number;
  timeoutMs?: number;
}

interface Prediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: unknown;
  error?: string | null;
  logs?: string;
  urls?: { get?: string; cancel?: string };
}

/** Minimal Replicate HTTP client (predictions + files API). */
export class ReplicateClient {
  private readonly f: Fetch;
  constructor(private readonly o: ReplicateClientOptions) {
    this.f = o.fetchImpl ?? fetch;
  }

  private headers(extra: Record<string, string> = {}) {
    return { Authorization: `Bearer ${this.o.apiKey}`, ...extra };
  }

  async uploadFile(data: Buffer, filename: string, contentType: string): Promise<{ id: string; url: string }> {
    const form = new FormData();
    form.append("content", new Blob([new Uint8Array(data)], { type: contentType }), filename);
    const res = await this.f(`${API}/files`, { method: "POST", headers: this.headers(), body: form });
    if (!res.ok) throw new ProcessingError("AI provider rejected the upload", `files ${res.status}: ${await res.text()}`);
    const body = (await res.json()) as { id: string; urls: { get: string } };
    return { id: body.id, url: body.urls.get };
  }

  async deleteFile(id: string): Promise<void> {
    await this.f(`${API}/files/${encodeURIComponent(id)}`, { method: "DELETE", headers: this.headers() }).catch(() => undefined);
  }

  /** model: "owner/name" (official/deployment) or "owner/name:version" */
  async run(model: string, input: Record<string, unknown>): Promise<Prediction> {
    const [ref, version] = model.split(":");
    const url = version ? `${API}/predictions` : `${API}/models/${ref}/predictions`;
    const body = version ? { version, input } : { input };
    const res = await this.f(url, {
      method: "POST",
      headers: this.headers({ "Content-Type": "application/json", Prefer: "wait=60" }),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new ProcessingError("AI processing failed to start", `${model} ${res.status}: ${await res.text()}`);
    let p = (await res.json()) as Prediction;
    const deadline = Date.now() + (this.o.timeoutMs ?? 20 * 60_000);
    while (p.status === "starting" || p.status === "processing") {
      if (Date.now() > deadline) {
        if (p.urls?.cancel) await this.f(p.urls.cancel, { method: "POST", headers: this.headers() }).catch(() => undefined);
        throw new ProcessingError("AI processing timed out", `prediction ${p.id} exceeded timeout`);
      }
      await new Promise((r) => setTimeout(r, this.o.pollIntervalMs ?? 2000));
      const poll = await this.f(p.urls?.get ?? `${API}/predictions/${p.id}`, { headers: this.headers() });
      if (!poll.ok) throw new ProcessingError("Lost contact with AI provider", `poll ${poll.status}`);
      p = (await poll.json()) as Prediction;
    }
    if (p.status !== "succeeded") {
      throw new ProcessingError("AI processing failed", `prediction ${p.id} ${p.status}: ${p.error ?? ""}\n${p.logs ?? ""}`);
    }
    return p;
  }

  async download(url: string): Promise<Buffer> {
    const res = await this.f(url);
    if (!res.ok) throw new ProcessingError("Could not download AI output", `${url} ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
}

export function outputUrl(output: unknown): string {
  if (typeof output === "string") return output;
  if (Array.isArray(output) && typeof output[output.length - 1] === "string") return output[output.length - 1] as string;
  if (output && typeof output === "object") {
    for (const v of Object.values(output as Record<string, unknown>)) if (typeof v === "string" && v.startsWith("http")) return v;
  }
  throw new ProcessingError("AI provider returned no image", JSON.stringify(output).slice(0, 500));
}

export interface TilePlan {
  cols: number;
  rows: number;
  tileW: number;
  tileH: number;
  overlap: number;
}

/** Split an image into a grid whose padded tiles stay under the provider's pixel limit. */
export function planTiles(width: number, height: number, maxTilePixels: number, overlap = 32): TilePlan {
  const side = Math.max(256, Math.floor(Math.sqrt(maxTilePixels)) - 2 * overlap);
  const cols = Math.max(1, Math.ceil(width / side));
  const rows = Math.max(1, Math.ceil(height / side));
  return { cols, rows, tileW: Math.ceil(width / cols), tileH: Math.ceil(height / rows), overlap };
}

/**
 * AI image restoration & super-resolution via Replicate-hosted models
 * (Real-ESRGAN for super resolution, NAFNet for denoise / deblur by default;
 * both configurable). Large images are processed in overlapping tiles and
 * stitched without seams. Generative face restoration (GFPGAN) is disabled
 * whenever Face Preservation is on — RESTORE, DON'T REDESIGN.
 */
export class ReplicateImageProvider implements ImageEnhancementProvider {
  readonly name = "replicate";
  private readonly client: ReplicateClient;
  private readonly classical = new ClassicalImageProvider();

  constructor(opts?: Partial<ReplicateClientOptions>) {
    const key = opts?.apiKey ?? env().AI_IMAGE_API_KEY;
    if (!key) throw new ProcessingError("AI image provider is not configured (AI_IMAGE_API_KEY missing)", undefined, false);
    this.client = new ReplicateClient({ ...opts, apiKey: key });
  }

  capabilities(): ProviderCapabilities {
    return {
      denoise: true,
      deblur: true,
      focusRecovery: true,
      detailRecovery: true,
      sharpen: true,
      upscaleFactors: [2, 4],
      isAi: true,
      description: "AI restoration (NAFNet) and super resolution (Real-ESRGAN) via Replicate. Face enhancement is disabled while Face Preservation is on.",
    };
  }

  async enhance(input: ProcessingInput, s: EnhancementStep): Promise<ProcessingResult> {
    const e = env();
    if (s.operation === "sharpen") return this.classical.enhance(input, s); // controlled, non-generative sharpening
    let model: string;
    let scale = 1;
    let params: Record<string, unknown>;
    switch (s.operation) {
      case "denoise":
        model = e.REPLICATE_MODEL_RESTORE;
        params = { task_type: "Image Denoising" };
        break;
      case "deblur":
        model = e.REPLICATE_MODEL_RESTORE;
        params = { task_type: "Image Debluring (GoPro)" };
        break;
      case "focusRecovery":
        model = e.REPLICATE_MODEL_RESTORE;
        params = { task_type: "Image Debluring (REDS)" };
        break;
      case "detailRecovery":
      case "upscale":
        model = e.REPLICATE_MODEL_UPSCALE;
        scale = s.operation === "upscale" ? (s.scale ?? 2) : 2;
        params = { scale, face_enhance: !s.facePreservation && s.quality === "maximum" };
        break;
    }
    const tiled = await this.runTiled(input, model, params, scale);
    if (s.operation === "detailRecovery") {
      // Super-resolve then resample back: recovers perceptual detail at the original size.
      const out = join(input.workDir, `detail-${Date.now().toString(36)}.tif`);
      await img(tiled).resize({ width: input.width, height: input.height, kernel: "lanczos3", fit: "fill" }).toColourspace("rgb16").tiff(TIFF16).toFile(out);
      return { path: out, width: input.width, height: input.height, engine: `${this.name}:${model}`, isAi: true };
    }
    const meta = await img(tiled).metadata();
    return { path: tiled, width: meta.width!, height: meta.height!, engine: `${this.name}:${model}`, isAi: true };
  }

  private async runTiled(input: ProcessingInput, model: string, params: Record<string, unknown>, scale: number): Promise<string> {
    const plan = planTiles(input.width, input.height, env().REPLICATE_MAX_TILE_PIXELS);
    input.log(`replicate ${model}: ${plan.cols}×${plan.rows} tiles, scale ${scale}`);
    const rowFiles: string[] = [];
    for (let r = 0; r < plan.rows; r++) {
      const tileFiles: string[] = [];
      const y0 = r * plan.tileH;
      const h = Math.min(plan.tileH, input.height - y0);
      for (let c = 0; c < plan.cols; c++) {
        const x0 = c * plan.tileW;
        const w = Math.min(plan.tileW, input.width - x0);
        const ex0 = Math.max(0, x0 - plan.overlap);
        const ey0 = Math.max(0, y0 - plan.overlap);
        const ex1 = Math.min(input.width, x0 + w + plan.overlap);
        const ey1 = Math.min(input.height, y0 + h + plan.overlap);
        const png = await img(input.path)
          .extract({ left: ex0, top: ey0, width: ex1 - ex0, height: ey1 - ey0 })
          .toColourspace("srgb")
          .png({ compressionLevel: 3 })
          .toBuffer();
        const file = await this.client.uploadFile(png, `tile-${r}-${c}.png`, "image/png");
        try {
          const pred = await this.client.run(model, { image: file.url, ...params });
          const result = await this.client.download(outputUrl(pred.output));
          const rm = await sharp(result).metadata();
          const expectW = (ex1 - ex0) * scale;
          const expectH = (ey1 - ey0) * scale;
          let tile = sharp(result);
          if (rm.width !== expectW || rm.height !== expectH) {
            tile = tile.resize({ width: expectW, height: expectH, fit: "fill", kernel: "lanczos3" });
          }
          const tilePath = join(input.workDir, `tile-${r}-${c}.tif`);
          const buf = await tile.toColourspace("rgb16").tiff({ compression: "none" }).toBuffer();
          await sharp(buf)
            .extract({ left: (x0 - ex0) * scale, top: (y0 - ey0) * scale, width: w * scale, height: h * scale })
            .toColourspace("rgb16")
            .tiff({ compression: "none" })
            .toFile(tilePath);
          tileFiles.push(tilePath);
        } finally {
          await this.client.deleteFile(file.id);
        }
      }
      const rowPath = join(input.workDir, `row-${r}.tif`);
      const rowWidth = input.width * scale;
      const rowHeight = h * scale;
      const joined = tileFiles.length === 1 ? img(tileFiles[0]!) : sharp(tileFiles, { join: { across: tileFiles.length }, limitInputPixels: false });
      await joined.extract({ left: 0, top: 0, width: rowWidth, height: rowHeight }).toColourspace("rgb16").tiff({ compression: "none", bigtiff: true }).toFile(rowPath);
      rowFiles.push(rowPath);
    }
    const out = join(input.workDir, `ai-${Date.now().toString(36)}.tif`);
    const all = rowFiles.length === 1 ? img(rowFiles[0]!) : sharp(rowFiles, { join: { across: 1 }, limitInputPixels: false });
    await all
      .extract({ left: 0, top: 0, width: input.width * scale, height: input.height * scale })
      .toColourspace("rgb16")
      .tiff(TIFF16)
      .toFile(out);
    await writeFile(join(input.workDir, "replicate-plan.json"), JSON.stringify({ model, params, plan, scale }));
    return out;
  }
}
