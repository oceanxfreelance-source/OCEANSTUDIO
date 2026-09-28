/**
 * Supported formats and server-side content validation. The filename extension
 * and browser-supplied MIME type are NEVER trusted on their own: after upload
 * the first bytes of the object are inspected (magic numbers) and must match.
 */
import type { MediaType } from "@prisma/client";

export interface FormatInfo {
  ext: string;
  mediaType: MediaType;
  mime: string;
  signature: (b: Buffer) => boolean;
  label: string;
}

const ascii = (b: Buffer, offset: number, s: string) => b.length >= offset + s.length && b.toString("latin1", offset, offset + s.length) === s;
const bytes = (b: Buffer, offset: number, arr: number[]) => arr.every((v, i) => b[offset + i] === v);
const isTiffContainer = (b: Buffer) => bytes(b, 0, [0x49, 0x49, 0x2a, 0x00]) || bytes(b, 0, [0x4d, 0x4d, 0x00, 0x2a]);
const isIsoBmff = (b: Buffer, brands: string[]) => ascii(b, 4, "ftyp") && brands.some((br) => ascii(b, 8, br));
const isQuickTime = (b: Buffer) =>
  ascii(b, 4, "ftyp") || ["moov", "mdat", "wide", "free", "skip", "pnot"].some((a) => ascii(b, 4, a));

export const FORMATS: FormatInfo[] = [
  // RAW — Nikon NEF is mandatory and first-class.
  { ext: "nef", mediaType: "RAW", mime: "image/x-nikon-nef", signature: isTiffContainer, label: "Nikon NEF" },
  { ext: "nrw", mediaType: "RAW", mime: "image/x-nikon-nrw", signature: isTiffContainer, label: "Nikon NRW" },
  { ext: "dng", mediaType: "RAW", mime: "image/x-adobe-dng", signature: isTiffContainer, label: "Adobe DNG" },
  { ext: "cr2", mediaType: "RAW", mime: "image/x-canon-cr2", signature: (b) => isTiffContainer(b) && ascii(b, 8, "CR"), label: "Canon CR2" },
  { ext: "cr3", mediaType: "RAW", mime: "image/x-canon-cr3", signature: (b) => isIsoBmff(b, ["crx "]), label: "Canon CR3" },
  { ext: "arw", mediaType: "RAW", mime: "image/x-sony-arw", signature: isTiffContainer, label: "Sony ARW" },
  { ext: "raf", mediaType: "RAW", mime: "image/x-fuji-raf", signature: (b) => ascii(b, 0, "FUJIFILMCCD-RAW"), label: "Fujifilm RAF" },
  {
    ext: "orf",
    mediaType: "RAW",
    mime: "image/x-olympus-orf",
    signature: (b) => ascii(b, 0, "IIRO") || ascii(b, 0, "IIRS") || ascii(b, 0, "MMOR") || isTiffContainer(b),
    label: "Olympus ORF",
  },
  { ext: "rw2", mediaType: "RAW", mime: "image/x-panasonic-rw2", signature: (b) => bytes(b, 0, [0x49, 0x49, 0x55, 0x00]), label: "Panasonic RW2" },
  // Photos
  { ext: "jpg", mediaType: "PHOTO", mime: "image/jpeg", signature: (b) => bytes(b, 0, [0xff, 0xd8, 0xff]), label: "JPEG" },
  { ext: "jpeg", mediaType: "PHOTO", mime: "image/jpeg", signature: (b) => bytes(b, 0, [0xff, 0xd8, 0xff]), label: "JPEG" },
  { ext: "png", mediaType: "PHOTO", mime: "image/png", signature: (b) => bytes(b, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), label: "PNG" },
  { ext: "tif", mediaType: "PHOTO", mime: "image/tiff", signature: (b) => isTiffContainer(b) || bytes(b, 0, [0x49, 0x49, 0x2b, 0x00]) || bytes(b, 0, [0x4d, 0x4d, 0x00, 0x2b]), label: "TIFF" },
  { ext: "tiff", mediaType: "PHOTO", mime: "image/tiff", signature: (b) => isTiffContainer(b) || bytes(b, 0, [0x49, 0x49, 0x2b, 0x00]) || bytes(b, 0, [0x4d, 0x4d, 0x00, 0x2b]), label: "TIFF" },
  { ext: "webp", mediaType: "PHOTO", mime: "image/webp", signature: (b) => ascii(b, 0, "RIFF") && ascii(b, 8, "WEBP"), label: "WebP" },
  // Video
  { ext: "mp4", mediaType: "VIDEO", mime: "video/mp4", signature: (b) => ascii(b, 4, "ftyp"), label: "MP4" },
  { ext: "m4v", mediaType: "VIDEO", mime: "video/x-m4v", signature: (b) => ascii(b, 4, "ftyp"), label: "M4V" },
  { ext: "mov", mediaType: "VIDEO", mime: "video/quicktime", signature: isQuickTime, label: "QuickTime MOV" },
  { ext: "avi", mediaType: "VIDEO", mime: "video/x-msvideo", signature: (b) => ascii(b, 0, "RIFF") && ascii(b, 8, "AVI "), label: "AVI" },
  { ext: "mkv", mediaType: "VIDEO", mime: "video/x-matroska", signature: (b) => bytes(b, 0, [0x1a, 0x45, 0xdf, 0xa3]), label: "Matroska MKV" },
];

const byExt = new Map(FORMATS.map((f) => [f.ext, f]));

export const SUPPORTED_EXTENSIONS = FORMATS.map((f) => f.ext);
export const RAW_EXTENSIONS = FORMATS.filter((f) => f.mediaType === "RAW").map((f) => f.ext);

export function extensionOf(filename: string): string {
  const m = /\.([A-Za-z0-9]{2,5})$/.exec(filename.trim());
  return m ? m[1]!.toLowerCase() : "";
}

export function formatForFilename(filename: string): FormatInfo | null {
  return byExt.get(extensionOf(filename)) ?? null;
}

export function isRawExtension(ext: string): boolean {
  return RAW_EXTENSIONS.includes(ext.toLowerCase());
}

/** Validate the leading bytes of an uploaded object against its declared format. */
export function verifySignature(format: FormatInfo, head: Buffer): boolean {
  return format.signature(head);
}

/**
 * Filenames are displayed and used in Content-Disposition, never in paths.
 * Strip control characters and path separators, keep everything else (unicode ok).
 */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, "").replace(/^\.+/, "").trim();
  return (cleaned || "file").slice(0, 200);
}

export function stem(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i > 0 ? filename.slice(0, i) : filename;
}
