import type { MediaType } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { storage } from "@/lib/storage/s3";

export async function pickerItems(types: MediaType[], projectId?: string) {
  const media = await db.mediaFile.findMany({
    where: { mediaType: { in: types }, status: "READY", ...(projectId ? { projectId } : {}) },
    orderBy: { createdAt: "desc" },
    take: 120,
    include: { project: { select: { name: true } } },
  });
  const ttl = env().PREVIEW_URL_TTL_SECONDS;
  return Promise.all(
    media.map(async (m) => ({
      id: m.id,
      filename: m.filename,
      mediaType: m.mediaType,
      projectName: m.project.name,
      thumbUrl: m.thumbKey ? await storage().presignGet(m.thumbKey, { expiresIn: ttl }) : null,
    })),
  );
}

export function projectOptions() {
  return db.project.findMany({ where: { status: { not: "ARCHIVED" } }, orderBy: { updatedAt: "desc" }, select: { id: true, name: true } });
}
