import { stat } from "node:fs/promises";
import type { ExportSettings, ProcessedFile } from "../raw/types";
import { copyMetadata } from "../metadata/exif";
import { img } from "./sharp";

export const EXPORT_FORMATS = {
  tiff16: { ext: "tif", mime: "image/tiff" },
  tiff8: { ext: "tif", mime: "image/tiff" },
  jpeg: { ext: "jpg", mime: "image/jpeg" },
  png: { ext: "png", mime: "image/png" },
} as const;

/**
 * Write the final derivative. Quality first: TIFF uses lossless deflate, JPEG
 * uses 4:4:4 chroma at the selected (high) quality, PNG is lossless. An sRGB
 * ICC profile is embedded and camera metadata is copied from the master.
 */
export async function exportImage(inputPath: string, s: ExportSettings): Promise<ProcessedFile> {
  const meta = await img(inputPath).metadata();
  const width = meta.width!;
  const height = meta.height!;
  let p = img(inputPath).removeAlpha().withIccProfile("srgb");
  switch (s.format) {
    case "tiff16": {
      const big = width * height * 6 > 3.5 * 1024 ** 3;
      p = p.toColourspace("rgb16").tiff({ compression: "deflate", predictor: "horizontal", bigtiff: big });
      break;
    }
    case "tiff8": {
      const big = width * height * 3 > 3.5 * 1024 ** 3;
      p = p.toColourspace("srgb").tiff({ compression: "deflate", predictor: "horizontal", bigtiff: big });
      break;
    }
    case "jpeg":
      if (width > 65500 || height > 65500) throw new Error("JPEG cannot exceed 65,500 px; choose TIFF for this output");
      p = p.toColourspace("srgb").jpeg({ quality: s.jpegQuality, chromaSubsampling: "4:4:4", optimiseCoding: true });
      break;
    case "png":
      p = p.toColourspace("rgb16").png({ compressionLevel: 6 });
      break;
  }
  await p.toFile(s.outputPath);
  if (s.metadataSource) await copyMetadata(s.metadataSource, s.outputPath);
  const { size } = await stat(s.outputPath);
  const f = EXPORT_FORMATS[s.format];
  return { path: s.outputPath, mimeType: f.mime, extension: f.ext, width, height, size };
}
