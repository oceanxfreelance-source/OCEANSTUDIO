"use client";

import { upload } from "@vercel/blob/client";

/** Browser-side video helpers shared by the single and bulk upload fields. */
export const MAX_VIDEO_MB = 500;

/** Returns an error message, or null when the file can be uploaded. */
export function checkVideoFile(file: File): string | null {
  if (!/^video\//.test(file.type) && !/\.(mp4|mov|m4v|webm)$/i.test(file.name)) return "Please choose a video.";
  if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
    return `This video is ${Math.round(file.size / 1024 / 1024)} MB. The limit is ${MAX_VIDEO_MB} MB — export a shorter or 1080p version.`;
  }
  return null;
}

/** Upload straight from the browser to video storage; resolves with the file's URL. */
export async function uploadVideo(file: File, onProgress: (percent: number) => void, signal?: AbortSignal): Promise<string> {
  const ext = (file.name.match(/\.(mp4|mov|m4v|webm)$/i)?.[1] ?? (file.type === "video/quicktime" ? "mov" : "mp4")).toLowerCase();
  const safeName = `${file.name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) || "video"}.${ext}`;
  const blob = await upload(`videos/${safeName}`, file, {
    access: "public",
    handleUploadUrl: "/api/admin/video-upload",
    contentType: file.type || "video/mp4",
    multipart: file.size > 20 * 1024 * 1024,
    abortSignal: signal,
    onUploadProgress: (p) => onProgress(Math.round(p.percentage)),
  });
  return blob.url;
}

/** Convert on the server into the phone-friendly version (~30–90 s); resolves with the new URL. */
export async function optimiseVideo(url: string): Promise<string> {
  const res = await fetch("/api/admin/video-optimize", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) });
  const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !json.url) throw new Error(json.error ?? `Error ${res.status}`);
  return json.url;
}
