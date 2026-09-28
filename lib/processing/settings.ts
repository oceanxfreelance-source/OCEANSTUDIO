import { z } from "zod";

/** Pure adjustment set shared by RAW development and color grading. All values are "slider units". */
export const colorAdjustmentsSchema = z.object({
  exposure: z.number().min(-5).max(5).default(0), // stops
  contrast: z.number().min(-100).max(100).default(0),
  highlights: z.number().min(-100).max(100).default(0),
  shadows: z.number().min(-100).max(100).default(0),
  whites: z.number().min(-100).max(100).default(0),
  blacks: z.number().min(-100).max(100).default(0),
  /** Relative white-balance shift: -100 (cooler) … +100 (warmer). */
  temperature: z.number().min(-100).max(100).default(0),
  tint: z.number().min(-100).max(100).default(0), // − green … + magenta
  saturation: z.number().min(-100).max(100).default(0),
  vibrance: z.number().min(-100).max(100).default(0),
  clarity: z.number().min(-100).max(100).default(0),
  dehaze: z.number().min(-100).max(100).default(0),
  sharpness: z.number().min(0).max(150).default(0),
});
export type ColorAdjustments = z.infer<typeof colorAdjustmentsSchema>;
export const NEUTRAL_ADJUSTMENTS: ColorAdjustments = colorAdjustmentsSchema.parse({});

/** RAW development settings (non-destructive; stored as JSON, the NEF is never modified). */
export const rawDevelopSettingsSchema = z.object({
  exposure: z.number().min(-5).max(5).default(0),
  /** Absolute white balance in Kelvin. null = camera as-shot white balance. */
  temperature: z.number().int().min(2000).max(50000).nullable().default(null),
  tint: z.number().min(-150).max(150).default(0),
  highlights: z.number().min(-100).max(100).default(0),
  shadows: z.number().min(-100).max(100).default(0),
  whites: z.number().min(-100).max(100).default(0),
  blacks: z.number().min(-100).max(100).default(0),
  contrast: z.number().min(-100).max(100).default(0),
  saturation: z.number().min(-100).max(100).default(0),
  vibrance: z.number().min(-100).max(100).default(0),
  clarity: z.number().min(-100).max(100).default(0),
  dehaze: z.number().min(-100).max(100).default(0),
  sharpness: z.number().min(0).max(150).default(25),
  detail: z.number().min(0).max(100).default(25),
  noiseReduction: z.number().min(0).max(100).default(0),
  highlightRecovery: z.enum(["clip", "blend", "rebuild"]).default("blend"),
});
export type RawDevelopSettings = z.infer<typeof rawDevelopSettingsSchema>;

export const COLOR_PRESETS = [
  "Natural",
  "Cinematic",
  "Maldives",
  "Ocean Blue",
  "Tropical",
  "Golden Hour",
  "Clean",
  "Moody",
  "Surf Documentary",
  "Black & White",
] as const;
export type ColorPresetName = (typeof COLOR_PRESETS)[number];

export const colorGradeSettingsSchema = z.object({
  preset: z.enum(COLOR_PRESETS).nullable().default(null),
  intensity: z.number().min(0).max(100).default(100),
  adjustments: colorAdjustmentsSchema.partial().default({}),
});
export type ColorGradeSettings = z.infer<typeof colorGradeSettingsSchema>;

export const outputFormatSchema = z.object({
  format: z.enum(["tiff16", "tiff8", "jpeg", "png"]).default("tiff16"),
  jpegQuality: z.number().int().min(80).max(100).default(98),
});
export type OutputFormat = z.infer<typeof outputFormatSchema>;

export const QUALITY_LEVELS = ["natural", "balanced", "maximum"] as const;
export type QualityLevel = (typeof QUALITY_LEVELS)[number];
export const UPSCALE_FACTORS = [1, 2, 4, 8] as const;
export type UpscaleFactor = (typeof UPSCALE_FACTORS)[number];

export const enhancementSettingsSchema = z.object({
  autoEnhance: z.boolean().default(false),
  denoise: z.boolean().default(false),
  deblur: z.boolean().default(false),
  focusRecovery: z.boolean().default(false),
  detailRecovery: z.boolean().default(false),
  sharpen: z.boolean().default(false),
  upscale: z.union([z.literal(1), z.literal(2), z.literal(4), z.literal(8)]).default(1),
  /** RESTORE, DON'T REDESIGN — on by default, see services/ai/fidelity.ts */
  facePreservation: z.boolean().default(true),
  quality: z.enum(QUALITY_LEVELS).default("natural"),
});
export type EnhancementSettings = z.infer<typeof enhancementSettingsSchema>;

export const photoJobSettingsSchema = z
  .object({
    sourceVersionId: z.string().min(1),
    raw: rawDevelopSettingsSchema.optional(),
    enhance: enhancementSettingsSchema.optional(),
    color: colorGradeSettingsSchema.optional(),
    output: outputFormatSchema.default({}),
    acknowledgeLargeOutput: z.boolean().default(false),
    acknowledgeMaximumQuality: z.boolean().default(false),
  })
  .superRefine((s, ctx) => {
    if (!s.raw && !s.enhance && !s.color) {
      ctx.addIssue({ code: "custom", message: "Select at least one operation (RAW develop, enhancement or color)." });
    }
    if (s.enhance?.upscale === 8 && !s.acknowledgeLargeOutput) {
      ctx.addIssue({
        code: "custom",
        path: ["acknowledgeLargeOutput"],
        message: "8× output can create extremely large files; confirm to continue.",
      });
    }
    if (s.enhance?.quality === "maximum" && !s.acknowledgeMaximumQuality) {
      ctx.addIssue({
        code: "custom",
        path: ["acknowledgeMaximumQuality"],
        message: "Maximum restoration can reconstruct plausible but not guaranteed detail; confirm to continue.",
      });
    }
  });
export type PhotoJobSettings = z.infer<typeof photoJobSettingsSchema>;

export const videoJobSettingsSchema = z.object({
  sourceVersionId: z.string().min(1),
  aiUpscale: z.boolean().default(false),
  denoise: z.boolean().default(false),
  deblur: z.boolean().default(false),
  stabilization: z.boolean().default(false),
  sharpen: z.boolean().default(false),
  lowLight: z.boolean().default(false),
  colorCorrection: z.boolean().default(false),
  color: colorGradeSettingsSchema.optional(),
  quality: z.enum(QUALITY_LEVELS).default("natural"),
  output: z
    .object({
      resolution: z.enum(["source", "1080p", "4k"]).default("source"),
      codec: z.enum(["h264", "hevc", "prores"]).default("h264"),
    })
    .default({}),
});
export type VideoJobSettings = z.infer<typeof videoJobSettingsSchema>;

/** Rough output estimate shown before 8× jobs. */
export function estimateOutput(width: number, height: number, scale: number, format: OutputFormat["format"]) {
  const w = width * scale;
  const h = height * scale;
  const bytesPerPixel = format === "tiff16" ? 6 : format === "tiff8" ? 3 : format === "png" ? 3 : 0.6;
  return { width: w, height: h, megapixels: (w * h) / 1e6, approxBytes: Math.round(w * h * bytesPerPixel) };
}
