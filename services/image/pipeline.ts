import { join } from "node:path";
import type { VersionType } from "@prisma/client";
import { ProcessingError } from "@/lib/errors";
import {
  NEUTRAL_ADJUSTMENTS,
  rawDevelopSettingsSchema,
  type ColorAdjustments,
  type PhotoJobSettings,
  type QualityLevel,
} from "@/lib/processing/settings";
import { checkFidelity, type FidelityReport } from "../ai/fidelity";
import type { EnhancementOperation, ImageEnhancementProvider, ProcessingInput } from "../ai/types";
import { applyGrade } from "../color/grade";
import { resolveGrade } from "../color/presets";
import type { FaceRegion, ProcessedFile, RawProcessor } from "../raw/types";
import { analyzeImage, type ImageAnalysis } from "./analysis";
import { exportImage } from "./export";
import { img } from "./sharp";
import { mapPixels } from "./strips";

export interface PhotoPipelineInput {
  sourcePath: string;
  sourceExtension: string;
  /** true when the source is the RAW master and must be decoded/developed first */
  developRaw: boolean;
  settings: PhotoJobSettings;
  workDir: string;
  jobId: string;
  faceRegions: FaceRegion[];
  /** file to copy camera metadata from (the master) */
  metadataSource: string;
  provider: ImageEnhancementProvider;
  rawProcessor: RawProcessor;
  log: (line: string) => void;
  progress: (fraction: number, stage: string) => Promise<void> | void;
}

export interface PhotoPipelineResult extends ProcessedFile {
  versionType: VersionType;
  isAi: boolean;
  engines: string[];
  scale: number;
  colorPreset: string | null;
  steps: string[];
  fidelity: FidelityReport[];
  analysis: ImageAnalysis | null;
  warnings: string[];
}

const STRENGTH: Record<QualityLevel, number> = { natural: 0.35, balanced: 0.6, maximum: 0.9 };
const TIFF16 = { compression: "none", bigtiff: true } as const;

/** 8× is composed from native passes, e.g. 4×→2× (or 2×→2×→2×). */
export function upscalePasses(factor: 1 | 2 | 4 | 8, supported: (2 | 4)[]): (2 | 4)[] {
  if (factor === 1) return [];
  const has4 = supported.includes(4);
  if (factor === 2) return [2];
  if (factor === 4) return has4 ? [4] : [2, 2];
  return has4 ? [4, 2] : [2, 2, 2];
}

/**
 * The OCEANX photo pipeline:
 *
 *   MASTER → (RAW DECODE → RAW DEVELOPMENT) → ANALYSIS → DENOISE → DEBLUR →
 *   DETAIL RESTORATION → FACE PRESERVATION → UPSCALE → SHARPEN → COLOR → FINAL
 *
 * Every step writes a new file in the job's work directory. The master is only
 * ever read, and the result is always a NEW derivative.
 */
export async function runPhotoPipeline(p: PhotoPipelineInput): Promise<PhotoPipelineResult> {
  const s = p.settings;
  const steps: string[] = [];
  const engines = new Set<string>();
  const fidelity: FidelityReport[] = [];
  const warnings: string[] = [];
  let isAi = false;
  let analysis: ImageAnalysis | null = null;

  // ---- 1. base image (RAW development or oriented 16-bit decode) ----------
  await p.progress(0.03, p.developRaw ? "RAW decode" : "Decode");
  let current: string;
  if (p.developRaw) {
    const developed = await p.rawProcessor.develop(
      { path: p.sourcePath, extension: p.sourceExtension },
      s.raw ?? rawDevelopSettingsSchema.parse({}),
      p.workDir,
    );
    current = developed.path;
    steps.push("RAW DEVELOPMENT");
    engines.add(p.rawProcessor.name);
  } else {
    current = join(p.workDir, "base.tif");
    await img(p.sourcePath, false).rotate().removeAlpha().toColourspace("rgb16").tiff(TIFF16).toFile(current);
  }
  await p.progress(0.2, "Analysis");

  const dims = async (path: string) => {
    const m = await img(path).metadata();
    return { width: m.width!, height: m.height! };
  };

  const e = s.enhance;
  const autoAdjust: Partial<ColorAdjustments> = {};
  let scale = 1;

  if (e) {
    if (e.autoEnhance) {
      analysis = await analyzeImage(current);
      Object.assign(autoAdjust, analysis.suggestions.adjustments);
      steps.push("ANALYSIS");
    }
    const strength = STRENGTH[e.quality];
    const ops: { op: EnhancementOperation; strength: number }[] = [];
    if (e.denoise || analysis?.suggestions.denoise)
      ops.push({ op: "denoise", strength: e.denoise ? strength : Math.max(0.2, analysis!.suggestions.denoiseStrength * strength) });
    if (e.deblur) ops.push({ op: "deblur", strength });
    if (e.focusRecovery) ops.push({ op: "focusRecovery", strength });
    if (e.detailRecovery) ops.push({ op: "detailRecovery", strength });

    const caps = p.provider.capabilities();
    for (const { op } of ops) {
      if (!caps[op as "denoise"]) {
        throw new ProcessingError(
          op === "deblur"
            ? "Motion deblur requires an AI image provider. Configure AI_IMAGE_PROVIDER=replicate."
            : `The configured provider does not support ${op}.`,
          `provider ${p.provider.name} lacks ${op}`,
          false,
        );
      }
    }

    // ---- 2. restoration steps, each checked by the fidelity guard ---------
    let i = 0;
    for (const { op, strength: k } of ops) {
      await p.progress(0.2 + (0.35 * i) / Math.max(1, ops.length), labelFor(op));
      const before = current;
      const d = await dims(before);
      const input: ProcessingInput = { path: before, ...d, workDir: p.workDir, jobId: p.jobId, faceRegions: p.faceRegions, log: p.log };
      const res = await p.provider.enhance(input, { operation: op, quality: e.quality, facePreservation: e.facePreservation, strength: k });
      isAi ||= res.isAi;
      engines.add(res.engine);
      current = await guard(before, res.path, op, e.quality, e.facePreservation, p, fidelity, warnings);
      steps.push(labelFor(op));
      i++;
    }
    if (e.facePreservation) steps.push("FACE PRESERVATION");

    // ---- 3. super resolution (2× / 4× / 8×) --------------------------------
    const passes = upscalePasses(e.upscale, caps.upscaleFactors);
    for (const [n, pass] of passes.entries()) {
      await p.progress(0.55 + (0.2 * n) / passes.length, `Upscale ${pass}× (pass ${n + 1}/${passes.length})`);
      const before = current;
      const d = await dims(before);
      const res = await p.provider.enhance(
        { path: before, ...d, workDir: p.workDir, jobId: p.jobId, faceRegions: p.faceRegions, log: p.log },
        { operation: "upscale", scale: pass, quality: e.quality, facePreservation: e.facePreservation, strength: STRENGTH[e.quality] },
      );
      if (res.width !== d.width * pass || res.height !== d.height * pass) {
        throw new ProcessingError("Upscale produced an unexpected size", `${res.width}×${res.height} from ${d.width}×${d.height} @${pass}`);
      }
      isAi ||= res.isAi;
      engines.add(res.engine);
      const report = await checkFidelity(before, res.path, { quality: e.quality, faceRegions: p.faceRegions });
      fidelity.push(report);
      if (!report.passed && e.facePreservation) {
        throw new ProcessingError(
          "Face preservation rejected the upscaled result: structure deviated from the original. Try Natural quality or a different provider.",
          JSON.stringify(report),
          false,
        );
      }
      current = res.path;
      scale *= pass;
    }
    if (scale > 1) steps.push(`UPSCALE ${scale}×`);

    if (e.sharpen || analysis?.suggestions.sharpen) {
      await p.progress(0.78, "Natural sharpening");
      const d = await dims(current);
      const res = await p.provider.enhance(
        { path: current, ...d, workDir: p.workDir, jobId: p.jobId, faceRegions: p.faceRegions, log: p.log },
        {
          operation: "sharpen",
          quality: e.quality,
          facePreservation: e.facePreservation,
          strength: e.sharpen ? STRENGTH[e.quality] : analysis!.suggestions.sharpenStrength * 0.5,
        },
      );
      engines.add(res.engine);
      current = res.path;
      steps.push("SHARPEN");
    }
  }

  // ---- 4. color --------------------------------------------------------------
  let colorPreset: string | null = null;
  if (s.color || Object.keys(autoAdjust).length > 0) {
    await p.progress(0.82, "Color");
    const grade = s.color ?? { preset: null, intensity: 100, adjustments: {} };
    const resolved = resolveGrade(grade);
    const adjustments = { ...NEUTRAL_ADJUSTMENTS, ...resolved.adjustments };
    for (const [k, v] of Object.entries(autoAdjust) as [keyof ColorAdjustments, number][]) adjustments[k] += v;
    const graded = join(p.workDir, "graded.tif");
    await applyGrade(current, graded, p.workDir, { adjustments, extras: resolved.extras });
    current = graded;
    colorPreset = grade.preset;
    if (s.color) steps.push(grade.preset ? `COLOR · ${grade.preset.toUpperCase()}` : "COLOR");
  }

  // ---- 5. export final derivative -------------------------------------------
  await p.progress(0.9, "Export");
  const ext = { tiff16: "tif", tiff8: "tif", jpeg: "jpg", png: "png" }[s.output.format];
  const out = await exportImage(current, {
    format: s.output.format,
    jpegQuality: s.output.jpegQuality,
    outputPath: join(p.workDir, `final.${ext}`),
    metadataSource: p.metadataSource,
  });

  const versionType: VersionType = e
    ? isAi
      ? "AI_ENHANCED"
      : scale > 1 && !e.denoise && !e.deblur && !e.focusRecovery && !e.detailRecovery && !e.autoEnhance
        ? "UPSCALED"
        : "ENHANCED"
    : s.color
      ? "COLOR_GRADED"
      : "RAW_DEVELOPED";

  return { ...out, versionType, isAi, engines: [...engines], scale, colorPreset, steps, fidelity, analysis, warnings };
}

function labelFor(op: EnhancementOperation): string {
  return {
    denoise: "DENOISE",
    deblur: "MOTION DEBLUR",
    focusRecovery: "FOCUS RECOVERY",
    detailRecovery: "DETAIL RESTORATION",
    sharpen: "SHARPEN",
    upscale: "UPSCALE",
  }[op];
}

/**
 * Same-size restoration guard. On failure with Face Preservation ON the result
 * is blended 50 % back toward the input and re-checked; if it still deviates
 * the job fails rather than delivering a redesigned face.
 */
async function guard(
  before: string,
  after: string,
  op: EnhancementOperation,
  quality: QualityLevel,
  facePreservation: boolean,
  p: PhotoPipelineInput,
  fidelity: FidelityReport[],
  warnings: string[],
): Promise<string> {
  const report = await checkFidelity(before, after, { quality, faceRegions: p.faceRegions });
  fidelity.push(report);
  if (report.passed) return after;
  if (!facePreservation) {
    warnings.push(`${labelFor(op)} changed image structure beyond the ${quality} threshold (SSIM ${report.globalSsim.toFixed(3)}).`);
    return after;
  }
  p.log(`fidelity guard: ${op} failed (${report.globalSsim.toFixed(4)}/${report.minBlockSsim.toFixed(4)}), blending back 50%`);
  const blended = join(p.workDir, `guard-${op}-${Date.now().toString(36)}.tif`);
  await mapPixels([after, before], blended, p.workDir, ([a, b]) => {
    for (let i = 0; i < a!.length; i++) a![i] = (a![i]! + b![i]!) * 0.5;
  });
  const second = await checkFidelity(before, blended, { quality, faceRegions: p.faceRegions });
  fidelity.push(second);
  if (!second.passed) {
    throw new ProcessingError(
      `Face preservation rejected ${labelFor(op).toLowerCase()}: the result altered image structure. Nothing was saved; try Natural quality.`,
      JSON.stringify(second),
      false,
    );
  }
  warnings.push(`${labelFor(op)} was softened by 50 % to stay within face-preservation limits.`);
  return blended;
}
