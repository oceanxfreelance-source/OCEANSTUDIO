import { requireAdmin } from "@/lib/auth/admin";
import { json, route } from "@/lib/http";
import { queueVerifyMaster } from "@/server/media";

export const POST = route<{ id: string }>(async (req, { id }) => {
  const { admin } = await requireAdmin(req);
  return json({ job: await queueVerifyMaster(id, admin.id) }, 202);
});
