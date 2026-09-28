import { requireAdmin } from "@/lib/auth/admin";
import { json, route } from "@/lib/http";
import { adminDownloadUrl } from "@/server/media";

/** Short-lived signed URL straight to private storage — large files are never proxied. */
export const POST = route<{ id: string }>(async (req, { id }) => {
  const { admin } = await requireAdmin(req);
  return json(await adminDownloadUrl(id, admin.id));
});
