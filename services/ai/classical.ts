import { join } from "node:path";
import { ProcessingError } from "@/lib/errors";
import { img } from "../image/sharp";
import { mapPixels } from "../image/strips";
import type { EnhancementStep, ImageEnhancementProvider, ProcessingInput, ProcessingResult, ProviderCapabilities } from "./types";

const TIFF16 = { compression: "none", bigtiff: true } as const;

/**
 * Deterministic, non-generative image restoration using libvips. It never
 * invents detail, so it is inherently identity-safe. It is NOT AI and its
 * results are labelled accordingly. Motion deblur requires an AI provider.
 */
export class ClassicalImageProvider implements ImageEnhancementProvider {
  readonly name = "classical-libvips";

  capabilities(): ProviderCapabilities {
    return {
      denoise: true,
      deblur: false,
      focusRecovery: true,
      detailRecovery: true,
      sharpen: true,
      upscaleFactors: [2, 4],
      isAi: false,
      description: "Classical (non-AI) processing: chroma/luma noise reduction, unsharp-mask focus & detail recovery, Lanczos-3 upscaling.",
    };
  }

  async enhance(input: ProcessingInput, s: EnhancementStep): Promise<ProcessingResult> {
    const out = join(input.workDir, `classical-${s.operation}-${Date.now().toString(36)}.tif`);
    const k = Math.max(0.05, Math.min(1, s.strength));
    switch (s.operation) {
      case "denoise": {
        // Chroma from a blurred copy (colour noise), luminance blended with a median (luma noise).
        const chroma = join(input.workDir, `nr-chroma-${Date.now().toString(36)}.tif`);
        const median = join(input.workDir, `nr-median-${Date.now().toString(36)}.tif`);
        await img(input.path).blur(1 + 2.5 * k).toColourspace("rgb16").tiff(TIFF16).toFile(chroma);
        await img(input.path).median(3).toColourspace("rgb16").tiff(TIFF16).toFile(median);
        const lumaMix = 0.25 + 0.5 * k;
        await mapPixels([input.path, chroma, median], out, input.workDir, ([o, c, m]) => {
          for (let i = 0; i < o!.length; i += 3) {
            const yo = 0.2126 * o![i]! + 0.7152 * o![i + 1]! + 0.0722 * o![i + 2]!;
            const ym = 0.2126 * m![i]! + 0.7152 * m![i + 1]! + 0.0722 * m![i + 2]!;
            const yc = 0.2126 * c![i]! + 0.7152 * c![i + 1]! + 0.0722 * c![i + 2]!;
            const y = yo + (ym - yo) * lumaMix;
            o![i] = y + (c![i]! - yc);
            o![i + 1] = y + (c![i + 1]! - yc);
            o![i + 2] = y + (c![i + 2]! - yc);
          }
        });
        break;
      }
      case "deblur":
        throw new ProcessingError(
          "Motion deblur requires an AI image provider. Configure AI_IMAGE_PROVIDER=replicate with AI_IMAGE_API_KEY.",
          "classical provider has no motion deblur",
          false,
        );
      case "focusRecovery": {
        // Two-radius unsharp mask approximates recovery of slight defocus without halos.
        const a = 0.6 + 1.4 * k;
        await img(input.path)
          .sharpen({ sigma: 2.2, m1: a * 0.3, m2: a, x1: 3, y2: 8, y3: 16 })
          .sharpen({ sigma: 0.9, m1: a * 0.2, m2: a * 0.6, x1: 2, y2: 6, y3: 12 })
          .toColourspace("rgb16")
          .tiff(TIFF16)
          .toFile(out);
        break;
      }
      case "detailRecovery": {
        const a = 0.4 + 0.8 * k;
        await img(input.path).sharpen({ sigma: 1.2, m1: a * 0.5, m2: a, x1: 2, y2: 6, y3: 12 }).toColourspace("rgb16").tiff(TIFF16).toFile(out);
        break;
      }
      case "sharpen": {
        const a = 0.5 + 1.5 * k;
        await img(input.path).sharpen({ sigma: 0.7, m1: 0.3, m2: a, x1: 2, y2: 8, y3: 16 }).toColourspace("rgb16").tiff(TIFF16).toFile(out);
        break;
      }
      case "upscale": {
        const scale = s.scale ?? 2;
        await img(input.path)
          .resize({ width: input.width * scale, height: input.height * scale, kernel: "lanczos3", fit: "fill" })
          .toColourspace("rgb16")
          .tiff(TIFF16)
          .toFile(out);
        break;
      }
    }
    const meta = await img(out).metadata();
    return { path: out, width: meta.width!, height: meta.height!, engine: this.name, isAi: false };
  }
}
