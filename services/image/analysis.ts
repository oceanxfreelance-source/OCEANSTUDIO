import type { ColorAdjustments } from "@/lib/processing/settings";
import { img } from "./sharp";

export interface ImageAnalysis {
  medianLuma: number;
  p01: number;
  p99: number;
  contrast: number;
  noiseSigma: number;
  sharpness: number;
  suggestions: {
    adjustments: Partial<ColorAdjustments>;
    denoise: boolean;
    denoiseStrength: number;
    sharpen: boolean;
    sharpenStrength: number;
  };
}

/**
 * Auto Enhance analysis: measures exposure, dynamic range, noise (MAD of a
 * median high-pass) and sharpness (Laplacian-based, from libvips) on a
 * downsample, then derives conservative corrections. Deterministic.
 */
export async function analyzeImage(path: string): Promise<ImageAnalysis> {
  const small = img(path).resize({ width: 1024, height: 1024, fit: "inside" }).greyscale();
  const { data, info } = await small.clone().raw().toBuffer({ resolveWithObject: true });
  const { data: med } = await small.clone().median(3).raw().toBuffer({ resolveWithObject: true });
  const stats = await img(path).resize({ width: 1024, height: 1024, fit: "inside" }).stats();

  const n = info.width * info.height;
  const hist = new Uint32Array(256);
  let sum = 0;
  let sumSq = 0;
  const residuals = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const v = data[i]!;
    hist[v]!++;
    sum += v;
    sumSq += v * v;
    residuals[i] = Math.abs(v - med[i]!);
  }
  const pct = (q: number) => {
    let acc = 0;
    for (let i = 0; i < 256; i++) {
      acc += hist[i]!;
      if (acc >= q * n) return i / 255;
    }
    return 1;
  };
  const mean = sum / n;
  const contrast = Math.sqrt(Math.max(0, sumSq / n - mean * mean)) / 255;
  residuals.sort();
  const noiseSigma = (1.4826 * residuals[Math.floor(n / 2)]!) / 255;
  const medianLuma = pct(0.5);
  const p01 = pct(0.01);
  const p99 = pct(0.99);
  const sharpness = stats.sharpness;

  const adjustments: Partial<ColorAdjustments> = {};
  // exposure toward a mid-grey median (sRGB ≈ 0.45), capped and halved for subtlety
  const lin = (v: number) => Math.pow(Math.max(0.01, v), 2.2);
  const ev = Math.log2(lin(0.45) / lin(Math.max(0.02, medianLuma))) * 0.5;
  if (Math.abs(ev) > 0.1) adjustments.exposure = Math.max(-1.5, Math.min(1.5, ev));
  if (p01 > 0.06) adjustments.blacks = -Math.min(30, (p01 - 0.06) * 200);
  if (p99 < 0.9) adjustments.whites = Math.min(30, (0.9 - p99) * 150);
  if (p99 >= 0.995) adjustments.highlights = -15;
  if (contrast < 0.18) adjustments.contrast = Math.min(25, (0.18 - contrast) * 200);
  adjustments.vibrance = 8;

  const denoise = noiseSigma > 0.012;
  const sharpen = sharpness < 2.5 && !denoise;
  return {
    medianLuma,
    p01,
    p99,
    contrast,
    noiseSigma,
    sharpness,
    suggestions: {
      adjustments,
      denoise,
      denoiseStrength: Math.min(1, noiseSigma / 0.04),
      sharpen,
      sharpenStrength: Math.min(1, Math.max(0.2, (2.5 - sharpness) / 2.5)),
    },
  };
}
