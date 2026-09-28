import { rename, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { ColorAdjustments } from "@/lib/processing/settings";
import { img, sharp } from "../image/sharp";
import { mapPixels } from "../image/strips";
import { compileEngine, type ToneExtras } from "./engine";

export interface GradeOptions {
  adjustments: ColorAdjustments;
  extras?: ToneExtras;
  wbMultipliers?: [number, number, number];
  linearInput?: boolean;
}

/**
 * Apply per-pixel tone/color (strip-wise, 16-bit) then neighbourhood operations
 * (clarity = large-radius local contrast, sharpness = small-radius unsharp mask)
 * with libvips. Always writes a NEW 16-bit TIFF; the input is never modified.
 */
export async function applyGrade(input: string, output: string, workDir: string, o: GradeOptions): Promise<void> {
  const engine = compileEngine({ adjustments: o.adjustments, extras: o.extras, wbMultipliers: o.wbMultipliers, linearInput: o.linearInput });
  const toned = join(workDir, `toned-${Date.now().toString(36)}.tif`);
  await mapPixels([input], toned, workDir, ([d]) => engine.apply(d!));
  const finished = await applyNeighbourhood(toned, output, o.adjustments, workDir);
  if (!finished) await rename(toned, output);
  else await rm(toned, { force: true });
}

/** Returns false when there was nothing to do (caller keeps the input as-is). */
export async function applyNeighbourhood(
  input: string,
  output: string,
  a: Pick<ColorAdjustments, "clarity" | "sharpness">,
  workDir?: string,
): Promise<boolean> {
  if (a.clarity === 0 && a.sharpness === 0) return false;
  const dir = workDir ?? dirname(output);
  let current = input;
  const temps: string[] = [];
  if (a.clarity !== 0) {
    // Clarity = midtone-weighted local contrast against a large-radius blur.
    // The blur is computed on a downsample and resized back, which is
    // equivalent for large radii and keeps 8× images fast.
    const meta = await img(input).metadata();
    const w = meta.width!;
    const h = meta.height!;
    const sigma = Math.max(4, Math.max(w, h) / 250);
    const factor = Math.max(1, sigma / 4);
    const blurred = join(dir, `clarity-blur-${Date.now().toString(36)}.tif`);
    const small = await img(input)
      .resize({ width: Math.max(8, Math.round(w / factor)), height: Math.max(8, Math.round(h / factor)), kernel: "cubic" })
      .blur(Math.max(0.5, sigma / factor))
      .toColourspace("rgb16")
      .tiff({ compression: "none" })
      .toBuffer();
    await sharp(small, { limitInputPixels: false })
      .resize({ width: w, height: h, fit: "fill", kernel: "cubic" })
      .toColourspace("rgb16")
      .tiff({ compression: "none", bigtiff: true })
      .toFile(blurred);
    temps.push(blurred);
    const k = (a.clarity / 100) * 0.9;
    const clarified = join(dir, `clarity-${Date.now().toString(36)}.tif`);
    await mapPixels([input, blurred], clarified, dir, ([d, b]) => {
      for (let i = 0; i < d!.length; i += 3) {
        const y = 0.2126 * d![i]! + 0.7152 * d![i + 1]! + 0.0722 * d![i + 2]!;
        const yb = 0.2126 * b![i]! + 0.7152 * b![i + 1]! + 0.0722 * b![i + 2]!;
        const mid = 1 - Math.abs(2 * y - 1) ** 2; // protect deep shadows and bright highlights
        const delta = k * mid * (y - yb);
        d![i] = d![i]! + delta;
        d![i + 1] = d![i + 1]! + delta;
        d![i + 2] = d![i + 2]! + delta;
      }
    });
    current = clarified;
  }
  if (a.sharpness > 0) {
    const amount = (a.sharpness / 150) * 2.5;
    await img(current)
      .sharpen({ sigma: 0.8, m1: amount * 0.4, m2: amount, x1: 2, y2: 10, y3: 20 })
      .toColourspace("rgb16")
      .tiff({ compression: "none", bigtiff: true })
      .toFile(output);
    if (current !== input) temps.push(current);
  } else {
    await rename(current, output);
  }
  await Promise.all(temps.map((t) => rm(t, { force: true })));
  return true;
}
