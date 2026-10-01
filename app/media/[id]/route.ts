import { db } from "@/lib/db";

/**
 * Serves uploaded images: /media/<id> (full) or /media/<id>?size=thumb.
 * Asset ids never change content, so browsers and Vercel's CDN may cache them
 * for a year.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-z0-9]{20,40}$/i.test(id)) return new Response("Not found", { status: 404 });
  const thumb = new URL(req.url).searchParams.get("size") === "thumb";
  const asset = thumb
    ? await db.mediaAsset.findUnique({ where: { id }, select: { mimeType: true, thumb: true } }).then((a) => a && { mimeType: a.mimeType, bytes: a.thumb })
    : await db.mediaAsset.findUnique({ where: { id }, select: { mimeType: true, data: true } }).then((a) => a && { mimeType: a.mimeType, bytes: a.data });
  const bytes = asset?.bytes ?? null;
  if (!asset || !bytes) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": asset.mimeType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
