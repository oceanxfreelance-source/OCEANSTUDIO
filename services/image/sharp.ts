import sharp from "sharp";

// Our own derivatives can be enormous (8× upscales exceed 380 MP), so the pixel
// limit is lifted for trusted, worker-side inputs. libvips streams tiles, it does
// not need the full image in memory for most operations.
sharp.cache({ memory: 512, files: 0, items: 100 });
sharp.concurrency(Math.max(1, Math.min(4, Number(process.env.SHARP_CONCURRENCY ?? 0) || 0)));

export const TRUSTED = { limitInputPixels: false as const, sequentialRead: false, failOn: "error" as const };
/** Uploaded files: bounded to 2 gigapixels to protect workers from decompression bombs. */
export const UNTRUSTED = { limitInputPixels: 2_000_000_000, failOn: "error" as const };

export function img(path: string, trusted = true) {
  return sharp(path, trusted ? TRUSTED : UNTRUSTED);
}

export { sharp };
