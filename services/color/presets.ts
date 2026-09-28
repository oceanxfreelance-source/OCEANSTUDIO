import { NEUTRAL_ADJUSTMENTS, type ColorAdjustments, type ColorGradeSettings, type ColorPresetName } from "@/lib/processing/settings";
import type { ToneExtras } from "./engine";

export interface PresetDefinition {
  name: ColorPresetName;
  description: string;
  adjustments: Partial<ColorAdjustments>;
  extras?: ToneExtras;
}

export const PRESETS: Record<ColorPresetName, PresetDefinition> = {
  Natural: {
    name: "Natural",
    description: "Faithful color with gentle contrast and vibrance.",
    adjustments: { contrast: 6, vibrance: 10, clarity: 4 },
  },
  Cinematic: {
    name: "Cinematic",
    description: "Teal shadows, warm highlights, softened contrast roll-off.",
    adjustments: { contrast: 14, highlights: -18, shadows: 8, saturation: -8, vibrance: 6, blacks: -6 },
    extras: { shadowTint: { hue: 190, strength: 0.07 }, highlightTint: { hue: 32, strength: 0.06 }, fade: 0.02 },
  },
  Maldives: {
    name: "Maldives",
    description: "Luminous turquoise water, clean whites, bright airy tone.",
    adjustments: { exposure: 0.15, highlights: -20, shadows: 16, whites: 10, vibrance: 22, temperature: -4, dehaze: 8 },
    extras: { hueSaturation: [{ hue: 180, width: 40, amount: 0.3 }] },
  },
  "Ocean Blue": {
    name: "Ocean Blue",
    description: "Deep saturated blues with neutral skin tones.",
    adjustments: { contrast: 10, highlights: -12, vibrance: 14, temperature: -10, clarity: 8, dehaze: 10 },
    extras: { hueSaturation: [{ hue: 210, width: 45, amount: 0.35 }], shadowTint: { hue: 215, strength: 0.05 } },
  },
  Tropical: {
    name: "Tropical",
    description: "Lush greens and warm sunlight.",
    adjustments: { contrast: 10, vibrance: 24, saturation: 6, temperature: 8, shadows: 10 },
    extras: { hueSaturation: [{ hue: 110, width: 45, amount: 0.25 }, { hue: 180, width: 30, amount: 0.15 }] },
  },
  "Golden Hour": {
    name: "Golden Hour",
    description: "Warm low-sun glow with soft highlights.",
    adjustments: { temperature: 22, tint: 4, highlights: -14, shadows: 12, vibrance: 12, contrast: 6 },
    extras: { highlightTint: { hue: 38, strength: 0.08 } },
  },
  Clean: {
    name: "Clean",
    description: "Bright, neutral, commercial look.",
    adjustments: { exposure: 0.1, whites: 12, blacks: -4, contrast: 8, saturation: -4, vibrance: 8, clarity: 6 },
  },
  Moody: {
    name: "Moody",
    description: "Darker tones, muted color, matte blacks.",
    adjustments: { exposure: -0.2, contrast: 18, highlights: -22, shadows: -6, saturation: -18, clarity: 10 },
    extras: { fade: 0.05, shadowTint: { hue: 220, strength: 0.05 } },
  },
  "Surf Documentary": {
    name: "Surf Documentary",
    description: "Punchy, sun-bleached, slightly faded film feel.",
    adjustments: { contrast: 16, highlights: -10, whites: 8, saturation: -6, vibrance: 14, clarity: 12, dehaze: 12, temperature: 5 },
    extras: { fade: 0.03, hueSaturation: [{ hue: 195, width: 40, amount: 0.2 }] },
  },
  "Black & White": {
    name: "Black & White",
    description: "Rich monochrome with deep blacks.",
    adjustments: { contrast: 20, clarity: 12, blacks: -8, whites: 6 },
    extras: { monochrome: { r: 0.3, g: 0.59, b: 0.11 } },
  },
};

/** Scale a preset by intensity (0…100) and combine with manual adjustments (manual wins additively). */
export function resolveGrade(grade: ColorGradeSettings): { adjustments: ColorAdjustments; extras: ToneExtras } {
  const k = grade.intensity / 100;
  const preset = grade.preset ? PRESETS[grade.preset] : null;
  const out: ColorAdjustments = { ...NEUTRAL_ADJUSTMENTS };
  for (const key of Object.keys(out) as (keyof ColorAdjustments)[]) {
    out[key] = (preset?.adjustments[key] ?? 0) * k + (grade.adjustments[key] ?? 0);
  }
  const clampKeys: [keyof ColorAdjustments, number, number][] = [
    ["exposure", -5, 5],
    ["sharpness", 0, 150],
  ];
  for (const key of Object.keys(out) as (keyof ColorAdjustments)[]) {
    const special = clampKeys.find((c) => c[0] === key);
    const [lo, hi] = special ? [special[1], special[2]] : [-100, 100];
    out[key] = Math.min(hi, Math.max(lo, out[key]));
  }
  const ex = preset?.extras ?? {};
  const extras: ToneExtras = {
    fade: ex.fade ? ex.fade * k : undefined,
    shadowTint: ex.shadowTint ? { hue: ex.shadowTint.hue, strength: ex.shadowTint.strength * k } : undefined,
    highlightTint: ex.highlightTint ? { hue: ex.highlightTint.hue, strength: ex.highlightTint.strength * k } : undefined,
    hueSaturation: ex.hueSaturation?.map((h) => ({ ...h, amount: h.amount * k })),
  };
  if (ex.monochrome) {
    // Partial intensity for B&W desaturates proportionally instead of a hard switch.
    if (k >= 0.999) extras.monochrome = ex.monochrome;
    else out.saturation = Math.max(-100, out.saturation - 100 * k);
  }
  return { adjustments: out, extras };
}
