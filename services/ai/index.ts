import { env } from "@/lib/env";
import { ClassicalImageProvider } from "./classical";
import { ReplicateImageProvider } from "./replicate";
import type { ImageEnhancementProvider } from "./types";

export function imageProvider(): ImageEnhancementProvider {
  return env().AI_IMAGE_PROVIDER === "replicate" ? new ReplicateImageProvider() : new ClassicalImageProvider();
}

export type { ImageEnhancementProvider } from "./types";
