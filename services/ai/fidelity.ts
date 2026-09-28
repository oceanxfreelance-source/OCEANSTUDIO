import type { QualityLevel } from "@/lib/processing/settings";
import type { FaceRegion } from "../raw/types";
import { img } from "../image/sharp";

/**
 * RESTORE, DON'T REDESIGN — structural fidelity guard.
 *
 * Restoration may add fine texture and remove noise/blur, but it must not move
 * or reshape structures (face shape, eyes, nose, jawline, proportions). We
 * compare the low-frequency luminance structure of the result against the
 * input with SSIM — globally, per block, and on every known face region at
 * higher resolution. A result that deviates beyond the threshold for the
 * chosen quality level is rejected (or blended back) by the pipeline.
 */

export const FIDELITY_THRESHOLDS: Record<QualityLevel, { global: number; block: number; face: number }> = {
  natural: { global: 0.96, block: 0.9, face: 0.94 },
  balanced: { global: 0.94, block: 0.85, face: 0.91 },
  maximum: { global: 0.9, block: 0.78, face: 0.87 },
};

export interface FidelityReport {
  passed: boolean;
  quality: QualityLevel;
  globalSsim: number;
  minBlockSsim: number;
  worstBlock: { x: number; y: number; w: number; h: number };
  faces: { region: FaceRegion; ssim: number; passed: boolean }[];
  thresholds: { global: number; block: number; face: number };
}

async function lowPassLuma(path: string, box: { left: number; top: number; width: number; height: number } | null, w: number, h: number, sigma: number) {
  let p = img(path);
  if (box) p = p.extract(box);
  const { data } = await p
    .resize({ width: w, height: h, fit: "fill", kernel: "lanczos3" })
    .greyscale()
    .blur(sigma)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const out = new Float32Array(w * h);
  for (let i = 0; i < out.length; i++) out[i] = data[i]! / 255;
  return out;
}

export function ssim(a: Float32Array, b: Float32Array, stride: number, x0: number, y0: number, w: number, h: number): number {
  const C1 = 0.01 ** 2;
  const C2 = 0.03 ** 2;
  let ma = 0,
    mb = 0;
  const n = w * h;
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) {
      ma += a[y * stride + x]!;
      mb += b[y * stride + x]!;
    }
  ma /= n;
  mb /= n;
  let va = 0,
    vb = 0,
    cov = 0;
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) {
      const da = a[y * stride + x]! - ma;
      const db = b[y * stride + x]! - mb;
      va += da * da;
      vb += db * db;
      cov += da * db;
    }
  va /= n - 1;
  vb /= n - 1;
  cov /= n - 1;
  return ((2 * ma * mb + C1) * (2 * cov + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2));
}

export async function checkFidelity(
  reference: string,
  candidate: string,
  opts: { quality: QualityLevel; faceRegions?: FaceRegion[] },
): Promise<FidelityReport> {
  const thresholds = FIDELITY_THRESHOLDS[opts.quality];
  const [rm, cm] = await Promise.all([img(reference).metadata(), img(candidate).metadata()]);
  const aspect = rm.width! / rm.height!;
  const W = aspect >= 1 ? 512 : Math.round(512 * aspect);
  const H = aspect >= 1 ? Math.round(512 / aspect) : 512;
  const [a, b] = await Promise.all([lowPassLuma(reference, null, W, H, 1.5), lowPassLuma(candidate, null, W, H, 1.5)]);
  const globalSsim = ssim(a, b, W, 0, 0, W, H);

  const B = 32;
  let minBlockSsim = 1;
  let worstBlock = { x: 0, y: 0, w: 0, h: 0 };
  for (let y = 0; y + B <= H; y += B / 2)
    for (let x = 0; x + B <= W; x += B / 2) {
      const s = ssim(a, b, W, x, y, B, B);
      if (s < minBlockSsim) {
        minBlockSsim = s;
        worstBlock = { x: x / W, y: y / H, w: B / W, h: B / H };
      }
    }

  const faces: FidelityReport["faces"] = [];
  for (const region of opts.faceRegions ?? []) {
    const boxFor = (m: { width?: number; height?: number }) => {
      const left = Math.max(0, Math.floor(region.x * m.width!));
      const top = Math.max(0, Math.floor(region.y * m.height!));
      return {
        left,
        top,
        width: Math.max(8, Math.min(m.width! - left, Math.ceil(region.w * m.width!))),
        height: Math.max(8, Math.min(m.height! - top, Math.ceil(region.h * m.height!))),
      };
    };
    const S = 128;
    const [fa, fb] = await Promise.all([lowPassLuma(reference, boxFor(rm), S, S, 1), lowPassLuma(candidate, boxFor(cm), S, S, 1)]);
    const s = ssim(fa, fb, S, 0, 0, S, S);
    faces.push({ region, ssim: s, passed: s >= thresholds.face });
  }

  const passed = globalSsim >= thresholds.global && minBlockSsim >= thresholds.block && faces.every((f) => f.passed);
  return { passed, quality: opts.quality, globalSsim, minBlockSsim, worstBlock, faces, thresholds };
}
