import { randomUUID } from "node:crypto";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getAdmin } from "@/lib/auth";
import { storageDriver, writeLocalPrivate } from "@/lib/storage";
import { MAX_VIDEO_BYTES, VIDEO_TYPES } from "@/lib/video-storage";

/**
 * Original clips go straight from the admin's phone to PRIVATE storage.
 *  - POST: Vercel Blob client-upload handshake (private store).
 *  - PUT ?name=…: local driver (development/tests) — the file body itself.
 */
export async function POST(request: Request) {
  if (!(await getAdmin())) return Response.json({ error: "Not signed in" }, { status: 401 });
  if (storageDriver() !== "vercel") return Response.json({ error: "Use PUT in local mode" }, { status: 400 });
  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }
  try {
    const result = await handleUpload({
      body,
      request,
      token: process.env.PRIVATE_BLOB_READ_WRITE_TOKEN,
      onBeforeGenerateToken: async (pathname) => {
        if (!(await getAdmin())) throw new Error("Not signed in");
        if (!pathname.startsWith("clips/") && !pathname.startsWith("files/")) throw new Error("Invalid path");
        return { allowedContentTypes: VIDEO_TYPES, maximumSizeInBytes: MAX_VIDEO_BYTES, addRandomSuffix: true };
      },
    });
    return Response.json(result);
  } catch (err) {
    const message = (err as Error).message;
    return Response.json({ error: message }, { status: message === "Not signed in" ? 401 : 400 });
  }
}

export async function PUT(request: Request) {
  if (!(await getAdmin())) return Response.json({ error: "Not signed in" }, { status: 401 });
  if (storageDriver() !== "local" || !request.body) return Response.json({ error: "Not available" }, { status: 400 });
  const name = (new URL(request.url).searchParams.get("name") ?? "clip.mp4").toLowerCase().replace(/[^a-z0-9.]+/g, "-").slice(-40);
  const folder = new URL(request.url).searchParams.get("folder") === "files" ? "files" : "clips";
  const key = `${folder}/${randomUUID()}-${name}`;
  const size = await writeLocalPrivate(key, request.body);
  if (size > MAX_VIDEO_BYTES) return Response.json({ error: "Too large" }, { status: 413 });
  return Response.json({ pathname: key, size });
}
