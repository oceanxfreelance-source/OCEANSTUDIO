import { db } from "@/lib/db";
import { notFound } from "@/lib/errors";
import type { FaceRegion } from "@/services/raw/types";
import { mediaView } from "./views";

/** Everything the admin media workspace needs, with signed preview URLs. */
export async function mediaDetail(id: string) {
  const m = await db.mediaFile.findUnique({
    where: { id },
    include: {
      versions: { orderBy: { versionNumber: "asc" } },
      metadata: true,
      project: { select: { id: true, name: true } },
      jobs: { orderBy: { createdAt: "desc" }, take: 12 },
      _count: { select: { favorites: true } },
    },
  });
  if (!m) throw notFound("File not found");
  const view = await mediaView(m);
  const faces = ((m.metadata?.faceRegions as FaceRegion[] | null) ?? []).map(({ x, y, w, h }) => ({ x, y, w, h }));
  return {
    ...view,
    project: m.project,
    metadata: m.metadata
      ? {
          cameraMake: m.metadata.cameraMake,
          cameraModel: m.metadata.cameraModel,
          lens: m.metadata.lens,
          iso: m.metadata.iso,
          shutter: m.metadata.shutter,
          aperture: m.metadata.aperture,
          focalLength: m.metadata.focalLength,
        }
      : null,
    faces,
    jobs: m.jobs.map((j) => ({
      id: j.id,
      jobType: j.jobType,
      status: j.status,
      progress: j.progress,
      stage: j.stage,
      errorMessage: j.errorMessage,
      createdAt: j.createdAt.toISOString(),
    })),
  };
}
