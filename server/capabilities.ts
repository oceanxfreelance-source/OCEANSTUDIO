import { env } from "@/lib/env";
import { ClassicalImageProvider } from "@/services/ai/classical";
import type { ProviderCapabilities } from "@/services/ai/types";

/** What the configured providers can do — the UI disables anything unsupported instead of faking it. */
export function capabilities(): { image: ProviderCapabilities & { provider: string; configured: boolean }; video: { provider: string; aiUpscale: boolean; deblur: boolean } } {
  const e = env();
  const replicate = e.AI_IMAGE_PROVIDER === "replicate";
  const configured = !replicate || Boolean(e.AI_IMAGE_API_KEY);
  const image: ProviderCapabilities = replicate
    ? {
        denoise: true,
        deblur: true,
        focusRecovery: true,
        detailRecovery: true,
        sharpen: true,
        upscaleFactors: [2, 4],
        isAi: true,
        description: "AI restoration (NAFNet) and super resolution (Real-ESRGAN) via Replicate. Face enhancement disabled while Face Preservation is on.",
      }
    : new ClassicalImageProvider().capabilities();
  const videoAi = e.AI_VIDEO_PROVIDER === "replicate" && Boolean(e.AI_VIDEO_API_KEY ?? e.AI_IMAGE_API_KEY);
  return {
    image: { ...image, provider: replicate ? "replicate" : "classical", configured },
    video: { provider: videoAi ? "replicate" : "ffmpeg", aiUpscale: videoAi, deblur: false },
  };
}
