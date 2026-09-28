import { stat } from "node:fs/promises";
import { join } from "node:path";
import { ProcessingError } from "@/lib/errors";
import { isRawExtension } from "@/lib/file-types";
import type { RawDevelopSettings } from "@/lib/processing/settings";
import { kelvinMultipliers, relativeWbMultipliers, srgbToLinear } from "../color/engine";
import { applyGrade } from "../color/grade";
import { run, runOrThrow } from "../exec";
import { exportImage } from "../image/export";
import { img, sharp } from "../image/sharp";
import { extractFaceRegions, readExif, summarize } from "../metadata/exif";
import type { DevelopedImage, ExportSettings, Preview, ProcessedFile, RawFile, RawMetadata, RawProcessor } from "./types";

/** Default rendering applied under the user's settings so a neutral develop is not flat. */
const BASE_LOOK = { contrast: 30, highlights: -10, blacks: -12 };
const clamp100 = (v: number) => Math.max(-100, Math.min(100, v));

const ORIENTATION_ANGLE: Record<number, number> = { 3: 180, 6: 90, 8: 270 };

export function parseRawIdentify(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const m = /^([A-Za-z][A-Za-z0-9 @/()._-]*?):\s*(.*)$/.exec(line.trim());
    if (m && !(m[1]! in out)) out[m[1]!] = m[2]!.trim();
  }
  return out;
}

function parseSize(v: string | undefined): [number, number] | null {
  const m = v ? /(\d+)\s*x\s*(\d+)/.exec(v) : null;
  return m ? [Number(m[1]), Number(m[2])] : null;
}

/**
 * RAW processor backed by LibRaw (dcraw_emu / raw-identify) and ExifTool.
 * LibRaw decodes NEF/DNG/CR2/CR3/ARW/RAF/ORF/RW2 to a linear 16-bit image; all
 * development then happens in 16-bit float in OCEANX's own tone engine.
 * The RAW file is only ever read.
 */
export class LibRawProcessor implements RawProcessor {
  readonly name = "libraw";

  canProcess(extension: string): boolean {
    return isRawExtension(extension);
  }

  async extractMetadata(file: RawFile): Promise<RawMetadata> {
    const [exif, ident] = await Promise.all([
      readExif(file.path),
      run("raw-identify", ["-v", file.path], { timeoutMs: 60_000 }),
    ]);
    if (ident.code !== 0) {
      throw new ProcessingError("RAW decode failed: LibRaw could not identify this file", ident.stderr || ident.stdout.toString());
    }
    const raw = parseRawIdentify(ident.stdout.toString("utf8"));
    const s = summarize(exif);
    let size = parseSize(raw["Output size"]) ?? parseSize(raw["Image size"]);
    if (size && (s.orientation === 6 || s.orientation === 8) && !raw["Output size"]) size = [size[1], size[0]];
    return {
      width: size?.[0] ?? null,
      height: size?.[1] ?? null,
      cameraMake: s.cameraMake,
      cameraModel: s.cameraModel,
      lens: s.lens,
      iso: s.iso,
      shutter: s.shutter,
      aperture: s.aperture,
      focalLength: s.focalLength,
      capturedAt: s.capturedAt,
      faceRegions: extractFaceRegions(exif),
      exif,
      raw,
    };
  }

  /** Embedded full-size JPEG if the camera stored one, otherwise a real half-size LibRaw decode. */
  async generatePreview(file: RawFile, outputJpeg: string): Promise<Preview> {
    const exif = await readExif(file.path);
    const angle = ORIENTATION_ANGLE[Number(exif.Orientation ?? 1)] ?? 0;
    for (const tag of ["-JpgFromRaw", "-PreviewImage", "-OtherImage"]) {
      const res = await run("exiftool", ["-b", tag, "--", file.path], { timeoutMs: 60_000 });
      if (res.code !== 0 || res.stdout.length < 1024) continue;
      try {
        const meta = await sharp(res.stdout).metadata();
        if (Math.max(meta.width ?? 0, meta.height ?? 0) < 1000) continue;
        const info = await sharp(res.stdout)
          .rotate(angle)
          .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 88, chromaSubsampling: "4:4:4" })
          .toFile(outputJpeg);
        return { path: outputJpeg, width: info.width, height: info.height, source: "embedded" };
      } catch {
        continue;
      }
    }
    const tiff = `${outputJpeg}.half.tiff`;
    await runOrThrow("dcraw_emu", ["-h", "-w", "-T", "-o", "1", "-Z", tiff, file.path], "RAW decode failed while generating preview", {
      timeoutMs: 300_000,
    });
    const info = await img(tiff)
      .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 88, chromaSubsampling: "4:4:4" })
      .toFile(outputJpeg);
    return { path: outputJpeg, width: info.width, height: info.height, source: "decoded" };
  }

  /**
   * RAW decode → linear 16-bit → white balance / exposure / tone / color in the
   * OCEANX engine → local contrast & sharpening. Returns a 16-bit sRGB TIFF.
   */
  async develop(file: RawFile, settings: RawDevelopSettings, workDir: string): Promise<DevelopedImage> {
    const linear = join(workDir, "raw-linear.tiff");
    const highlight = { clip: "0", blend: "2", rebuild: "5" }[settings.highlightRecovery];
    const args = ["-4", "-T", "-o", "1", "-q", "3", "-H", highlight];
    if (settings.temperature === null) args.push("-w"); // camera as-shot WB; otherwise daylight reference
    if (settings.noiseReduction > 0) args.push("-n", String(Math.round(settings.noiseReduction * 8)));
    args.push("-Z", linear, file.path);
    await runOrThrow("dcraw_emu", args, "RAW decode failed: LibRaw could not decode this file", { timeoutMs: 30 * 60_000 });
    const { size } = await stat(linear);
    if (size === 0) throw new ProcessingError("RAW decode produced no output");

    // Baseline brightness equivalent to dcraw's auto-bright (1% highlights),
    // computed on a downsample so it is cheap for any sensor size.
    const baseline = await autoBrightStops(linear);
    const wb =
      settings.temperature !== null
        ? kelvinMultipliers(settings.temperature, settings.tint)
        : settings.tint !== 0
          ? relativeWbMultipliers(0, (settings.tint / 150) * 100)
          : ([1, 1, 1] as [number, number, number]);

    const developed = join(workDir, "developed.tif");
    const sharpness = settings.sharpness * (0.5 + settings.detail / 100);
    // dcraw_emu tags its output with a linear-gamma ICC profile; libvips honours
    // it and hands the engine sRGB-encoded 16-bit samples, which the engine
    // linearises again before white balance and exposure.
    await applyGrade(linear, developed, workDir, {
      linearInput: false,
      wbMultipliers: wb,
      adjustments: {
        exposure: Math.max(-5, Math.min(5, settings.exposure + baseline)),
        // Base rendering curve (like any RAW developer's default "camera look"),
        // user adjustments are added on top.
        contrast: clamp100(BASE_LOOK.contrast + settings.contrast),
        highlights: clamp100(BASE_LOOK.highlights + settings.highlights),
        shadows: settings.shadows,
        whites: settings.whites,
        blacks: clamp100(BASE_LOOK.blacks + settings.blacks),
        temperature: 0,
        tint: 0,
        saturation: settings.saturation,
        vibrance: settings.vibrance,
        clarity: settings.clarity,
        dehaze: settings.dehaze,
        sharpness: Math.min(150, sharpness),
      },
    });
    const meta = await img(developed).metadata();
    return { path: developed, width: meta.width!, height: meta.height!, bitDepth: 16 };
  }

  export(image: DevelopedImage, settings: ExportSettings): Promise<ProcessedFile> {
    return exportImage(image.path, settings);
  }
}

/** Stops of gain so that ~1% of pixels reach white, clamped to a sane range. */
export async function autoBrightStops(linearTiff: string): Promise<number> {
  const { data, info } = await img(linearTiff)
    .resize({ width: 800, height: 800, fit: "inside" })
    .toColourspace("rgb16")
    .raw({ depth: "ushort" })
    .toBuffer({ resolveWithObject: true });
  const u16 = new Uint16Array(data.buffer, data.byteOffset, data.byteLength / 2);
  const hist = new Uint32Array(4096);
  const px = info.width * info.height;
  for (let i = 0; i < u16.length; i += info.channels) {
    const m = Math.max(u16[i]!, u16[i + 1]!, u16[i + 2]!);
    hist[m >> 4]!++;
  }
  let acc = 0;
  let p99 = 4095;
  for (let b = 4095; b >= 0; b--) {
    acc += hist[b]!;
    if (acc >= px * 0.01) {
      p99 = b;
      break;
    }
  }
  // samples are sRGB-encoded (see develop()); measure the gain in linear light
  const level = srgbToLinear(Math.max(1, p99) / 4095);
  return Math.max(0, Math.min(3, Math.log2(1 / level)));
}

let defaultProcessor: RawProcessor | null = null;
export function rawProcessor(): RawProcessor {
  defaultProcessor ??= new LibRawProcessor();
  return defaultProcessor;
}
