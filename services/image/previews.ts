import { join } from "node:path";
import { img } from "./sharp";

export interface ImagePreviewSet {
  preview: string;
  thumb: string;
  detail: string | null;
  width: number;
  height: number;
}

/**
 * Browser previews (sRGB JPEG). These are for fast viewing only and are never
 * offered as downloads — downloads always serve the exact stored file.
 * `detail` is a large inspection image (≤ 8192 px) used for 100 % / face zoom.
 */
export async function makeImagePreviews(input: string, outDir: string, trusted = true): Promise<ImagePreviewSet> {
  const meta = await img(input, trusted).metadata();
  const auto = (p: ReturnType<typeof img>) => p.rotate(); // honour EXIF orientation for camera JPEGs
  const preview = join(outDir, "preview.jpg");
  const thumb = join(outDir, "thumb.jpg");
  const info = await auto(img(input, trusted))
    .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
    .toColourspace("srgb")
    .jpeg({ quality: 84, chromaSubsampling: "4:4:4", mozjpeg: true })
    .toFile(preview);
  await auto(img(input, trusted))
    .resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true })
    .toColourspace("srgb")
    .jpeg({ quality: 78, mozjpeg: true })
    .toFile(thumb);
  let detail: string | null = null;
  if (Math.max(meta.width ?? 0, meta.height ?? 0) > 2048) {
    detail = join(outDir, "detail.jpg");
    await auto(img(input, trusted))
      .resize({ width: 8192, height: 8192, fit: "inside", withoutEnlargement: true })
      .toColourspace("srgb")
      .jpeg({ quality: 90, chromaSubsampling: "4:4:4" })
      .toFile(detail);
  }
  return { preview, thumb, detail, width: info.width, height: info.height };
}
