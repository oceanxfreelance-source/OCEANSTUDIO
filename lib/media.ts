import "server-only";
import sharp, { type Metadata } from "sharp";
import { db } from "./db";

/**
 * Image uploads. Every upload is re-encoded with sharp:
 *  - auto-rotated from camera EXIF, then all metadata (incl. GPS) removed
 *  - full size: max 2400px wide, WebP
 *  - thumbnail: max 900px wide, WebP (used on phones and in grids)
 * Re-encoding also guarantees the stored file is a real image.
 */

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const ACCEPTED = new Set(["jpeg", "png", "webp", "avif", "heif", "tiff", "gif"]);

export class MediaError extends Error {}

export async function saveImage(input: Buffer, alt = ""): Promise<{ id: string; width: number; height: number }> {
  if (input.length === 0) throw new MediaError("The file is empty.");
  if (input.length > MAX_UPLOAD_BYTES) throw new MediaError("Image is too large (max 25 MB).");

  let meta: Metadata;
  try {
    meta = await sharp(input, { limitInputPixels: 120_000_000 }).metadata();
  } catch {
    throw new MediaError("This file is not a supported image.");
  }
  if (!meta.format || !ACCEPTED.has(meta.format)) throw new MediaError("Please upload a JPG, PNG, WebP, HEIC or AVIF image.");

  const base = () => sharp(input, { limitInputPixels: 120_000_000 }).rotate();
  const full = await base()
    .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer({ resolveWithObject: true });
  const thumb = await base().resize({ width: 900, height: 1400, fit: "inside", withoutEnlargement: true }).webp({ quality: 74 }).toBuffer();

  const asset = await db.mediaAsset.create({
    data: {
      mimeType: "image/webp",
      width: full.info.width,
      height: full.info.height,
      size: full.data.length,
      data: full.data,
      thumb,
      alt: alt.slice(0, 300),
    },
    select: { id: true, width: true, height: true },
  });
  return asset;
}
