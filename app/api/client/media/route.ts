import { requireClient } from "@/lib/auth/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { notFound } from "@/lib/errors";
import { json, route } from "@/lib/http";
import { storage } from "@/lib/storage/s3";

/** One file's fresh preview URL. Only files of THIS delivery whose version is still published. */
export const GET = route(async (req) => {
  const sp = req.nextUrl.searchParams;
  const { delivery } = await requireClient(req, sp.get("token") ?? "");
  const f = await db.deliveryFile.findFirst({
    where: { id: sp.get("fileId") ?? "", deliveryId: delivery.id, copiedAt: { not: null }, version: { published: true } },
    include: { favorites: { select: { id: true } } },
  });
  if (!f) throw notFound("File not found");
  const ttl = env().PREVIEW_URL_TTL_SECONDS;
  return json({
    id: f.id,
    filename: f.filename,
    label: f.label,
    mediaType: f.mediaType,
    size: Number(f.size),
    width: f.width,
    height: f.height,
    duration: f.duration,
    favorite: f.favorites.length > 0,
    previewUrl: f.previewKey ? await storage().presignGet(f.previewKey, { expiresIn: ttl }) : null,
  });
});
