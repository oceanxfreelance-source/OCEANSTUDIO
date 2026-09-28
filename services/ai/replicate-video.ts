import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { env } from "@/lib/env";
import { ProcessingError } from "@/lib/errors";
import { outputUrl, ReplicateClient } from "./replicate";
import type { ProcessingResult, VideoEnhancementProvider, VideoEnhancementSettings, VideoProcessingInput } from "./types";

const MAX_INLINE_UPLOAD = 100 * 1024 ** 2;

/**
 * AI video super-resolution via a Replicate-hosted Real-ESRGAN video model.
 * The source is passed as a short-lived signed URL (preferred) or uploaded via
 * the Files API for small clips. Output is downloaded and then finished by the
 * FFmpeg pipeline (color, sharpening, encoding, original audio).
 */
export class ReplicateVideoProvider implements VideoEnhancementProvider {
  readonly name = "replicate-video";
  readonly isAi = true;
  private readonly client: ReplicateClient;

  constructor(apiKey = env().AI_VIDEO_API_KEY ?? env().AI_IMAGE_API_KEY) {
    if (!apiKey) throw new ProcessingError("AI video provider is not configured (AI_VIDEO_API_KEY missing)", undefined, false);
    this.client = new ReplicateClient({ apiKey, timeoutMs: 6 * 3600_000, pollIntervalMs: 5000 });
  }

  async enhance(input: VideoProcessingInput & { sourceUrl?: string }, s: VideoEnhancementSettings): Promise<ProcessingResult> {
    const model = env().REPLICATE_MODEL_VIDEO_UPSCALE;
    let url = input.sourceUrl;
    let fileId: string | null = null;
    if (!url) {
      const data = await readFile(input.path);
      if (data.length > MAX_INLINE_UPLOAD) throw new ProcessingError("Video too large for direct AI upload", `size ${data.length}`);
      const f = await this.client.uploadFile(data, "input.mp4", "video/mp4");
      url = f.url;
      fileId = f.id;
    }
    try {
      input.log(`replicate video ${model} scale ${s.scale}`);
      input.onProgress(0.05);
      const pred = await this.client.run(model, { video_path: url, model: "RealESRGAN_x4plus", resolution: s.targetHeight === 2160 ? "4k" : s.targetHeight === 1080 ? "FHD" : "2k" });
      const out = join(input.workDir, "ai-upscaled.mp4");
      await writeFile(out, await this.client.download(outputUrl(pred.output)));
      input.onProgress(1);
      return { path: out, width: input.width * s.scale, height: input.height * s.scale, engine: `${this.name}:${model}`, isAi: true };
    } finally {
      if (fileId) await this.client.deleteFile(fileId);
    }
  }
}
