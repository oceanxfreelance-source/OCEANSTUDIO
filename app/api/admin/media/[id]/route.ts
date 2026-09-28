import { requireAdmin } from "@/lib/auth/admin";
import { json, route } from "@/lib/http";
import { getMedia, signedVersionAssets } from "@/server/media";

export const GET = route<{ id: string }>(async (req, { id }) => {
  await requireAdmin(req);
  const media = await getMedia(id);
  const versions = await Promise.all(media.versions.map(async (v) => ({ ...v, ...(await signedVersionAssets(v)) })));
  return json({ media: { ...media, versions } });
});
