import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { img, sharp } from "./sharp";

export interface StripContext {
  width: number;
  height: number;
  y0: number;
  rows: number;
}

/**
 * Apply a per-pixel function to one or more same-sized images, processing
 * horizontal strips so memory stays bounded regardless of image size (8×
 * outputs can be hundreds of megapixels). Data is float RGB in 0…1 decoded
 * from 16-bit samples; output is written as a 16-bit TIFF.
 */
export async function mapPixels(
  inputs: string[],
  output: string,
  workDir: string,
  fn: (data: Float32Array[], ctx: StripContext) => void,
  opts: { stripPixels?: number } = {},
): Promise<{ width: number; height: number }> {
  if (inputs.length === 0) throw new Error("mapPixels requires at least one input");
  const metas = await Promise.all(inputs.map((p) => img(p).metadata()));
  const width = metas[0]!.width!;
  const height = metas[0]!.height!;
  for (const m of metas) {
    if (m.width !== width || m.height !== height) throw new Error("mapPixels inputs must have identical dimensions");
  }
  const rowsPerStrip = Math.max(16, Math.floor((opts.stripPixels ?? 4_000_000) / width));
  const stripDir = join(workDir, `strips-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);
  await mkdir(stripDir, { recursive: true });
  const stripFiles: string[] = [];
  try {
    for (let y0 = 0; y0 < height; y0 += rowsPerStrip) {
      const rows = Math.min(rowsPerStrip, height - y0);
      const datas = await Promise.all(
        inputs.map(async (p) => {
          const { data } = await img(p)
            .extract({ left: 0, top: y0, width, height: rows })
            .removeAlpha()
            .toColourspace("rgb16")
            .raw({ depth: "ushort" })
            .toBuffer({ resolveWithObject: true });
          const u16 = new Uint16Array(data.buffer, data.byteOffset, data.byteLength / 2);
          const f = new Float32Array(u16.length);
          for (let i = 0; i < u16.length; i++) f[i] = u16[i]! / 65535;
          return f;
        }),
      );
      fn(datas, { width, height, y0, rows });
      const out = datas[0]!;
      const u16 = new Uint16Array(out.length);
      for (let i = 0; i < out.length; i++) {
        const v = out[i]!;
        u16[i] = v <= 0 ? 0 : v >= 1 ? 65535 : Math.round(v * 65535);
      }
      const stripPath = join(stripDir, `${String(stripFiles.length).padStart(5, "0")}.tif`);
      await sharp(u16, { raw: { width, height: rows, channels: 3, premultiplied: false } })
        .toColourspace("rgb16")
        .tiff({ compression: "none" })
        .toFile(stripPath);
      stripFiles.push(stripPath);
    }
    await joinVertical(stripFiles, output, width, height);
    return { width, height };
  } finally {
    await rm(stripDir, { recursive: true, force: true });
  }
}

/**
 * Stack strip files vertically into a 16-bit TIFF. libvips' join uses uniform
 * cell sizes, so the (shorter) last strip is padded; the final extract removes it.
 */
export async function joinVertical(files: string[], output: string, width: number, height: number): Promise<void> {
  const pipeline =
    files.length === 1
      ? img(files[0]!)
      : sharp(files, { join: { across: 1 }, limitInputPixels: false }).extract({ left: 0, top: 0, width, height });
  await pipeline.toColourspace("rgb16").tiff({ compression: "none", bigtiff: true }).toFile(output);
}
