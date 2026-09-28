import { requireAdmin } from "@/lib/auth/admin";
import { json, route } from "@/lib/http";
import { listMedia, signedVersionAssets } from "@/server/media";
import { getProject } from "@/server/projects";

export const GET = route<{ id: string }>(async (req, { id }) => {
  await requireAdmin(req);
  await getProject(id);
  const media = await listMedia(id);
  const withUrls = await Promise.all(
    media.map(async (m) => ({ ...m, thumbUrl: (await signedVersionAssets({ previewKey: null, thumbKey: m.thumbKey, detailKey: null })).thumbUrl })),
  );
  return json({ media: withUrls });
});
