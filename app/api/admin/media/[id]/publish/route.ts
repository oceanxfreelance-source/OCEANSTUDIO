import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { json, parseJson, route } from "@/lib/http";
import { publishMediaVersion } from "@/server/media";

/** Only explicitly published versions ever appear in client galleries. */
export const POST = route<{ id: string }>(async (req, { id }) => {
  const { admin } = await requireAdmin(req);
  const { versionId } = await parseJson(req, z.object({ versionId: z.string().min(1).max(64).optional() }));
  return json({ version: await publishMediaVersion(id, versionId, true, admin.id) });
});
