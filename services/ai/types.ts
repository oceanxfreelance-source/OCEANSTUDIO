import type { FaceRegion } from "../raw/types";
import type { QualityLevel } from "@/lib/processing/settings";

export interface ProcessingInput {
  /** 16-bit TIFF (or any sharp-readable image) on local disk */
  path: string;
  width: number;
  height: number;
  workDir: string;
  jobId: string;
  faceRegions?: FaceRegion[];
  log: (line: string) => void;
}

export type EnhancementOperation = "denoise" | "deblur" | "focusRecovery" | "detailRecovery" | "sharpen" | "upscale";

export interface EnhancementStep {
  operation: EnhancementOperation;
  quality: QualityLevel;
  /** 2 or 4 for a single upscale pass (8× is composed of passes by the pipeline) */
  scale?: 2 | 4;
  facePreservation: boolean;
  /** 0…1 strength derived from analysis (auto enhance) or quality level */
  strength: number;
}

export interface ProcessingResult {
  path: string;
  width: number;
  height: number;
  engine: string;
  isAi: boolean;
  notes?: string[];
}

export interface ProviderCapabilities {
  denoise: boolean;
  deblur: boolean;
  focusRecovery: boolean;
  detailRecovery: boolean;
  sharpen: boolean;
  /** single-pass upscale factors this provider supports natively */
  upscaleFactors: (2 | 4)[];
  isAi: boolean;
  description: string;
}

export interface ImageEnhancementProvider {
  readonly name: string;
  capabilities(): ProviderCapabilities;
  enhance(input: ProcessingInput, settings: EnhancementStep): Promise<ProcessingResult>;
}

export interface VideoEnhancementSettings {
  scale: 2 | 4;
  targetHeight: number | null;
  facePreservation: boolean;
}

export interface VideoProcessingInput {
  path: string;
  width: number;
  height: number;
  duration: number;
  workDir: string;
  jobId: string;
  log: (line: string) => void;
  onProgress: (fraction: number) => void;
}

export interface VideoEnhancementProvider {
  readonly name: string;
  readonly isAi: boolean;
  enhance(input: VideoProcessingInput, settings: VideoEnhancementSettings): Promise<ProcessingResult>;
}
