import "server-only";
import { del } from "@vercel/blob";

/** Videos uploaded from the admin are stored in Vercel Blob (free tier on Hobby). */
// Phones label gallery videos differently (iPhone: video/quicktime, Android: video/mp4…).
export const VIDEO_TYPES = ["video/*"];
export const MAX_VIDEO_BYTES = 500 * 1024 * 1024; // 500 MB per file

/** True for files we host in our own Blob store (not YouTube/Vimeo links). */
export function isOurVideo(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    return new URL(url).hostname.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}

/**
 * Delete an uploaded video that is no longer used (replaced or its item
 * deleted), so storage doesn't fill up. Links to YouTube etc. are ignored.
 */
export async function deleteVideoIfUnused(oldUrl: string | null | undefined, newUrl?: string | null): Promise<void> {
  if (!isOurVideo(oldUrl) || oldUrl === newUrl || !process.env.BLOB_READ_WRITE_TOKEN) return;
  await del(oldUrl).catch((err) => console.error("could not delete old video", err));
}
