import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getAdmin } from "@/lib/auth";
import { MAX_VIDEO_BYTES, VIDEO_TYPES } from "@/lib/video-storage";

/**
 * Issues short-lived upload permission so the admin's browser can send a video
 * straight to Vercel Blob storage (large files never pass through this server).
 * Only a signed-in admin can get a token.
 */
export async function POST(request: Request) {
  if (!(await getAdmin())) return Response.json({ error: "Not signed in" }, { status: 401 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json({ error: "Video storage is not connected (BLOB_READ_WRITE_TOKEN missing)." }, { status: 503 });
  }
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
      onBeforeGenerateToken: async (pathname) => {
        const admin = await getAdmin();
        if (!admin) throw new Error("Not signed in");
        if (!pathname.startsWith("videos/")) throw new Error("Invalid path");
        return {
          allowedContentTypes: VIDEO_TYPES,
          maximumSizeInBytes: MAX_VIDEO_BYTES,
          addRandomSuffix: true,
          cacheControlMaxAge: 60 * 60 * 24 * 365,
        };
      },
    });
    return Response.json(result);
  } catch (err) {
    const message = (err as Error).message;
    return Response.json({ error: message }, { status: message === "Not signed in" ? 401 : 400 });
  }
}
