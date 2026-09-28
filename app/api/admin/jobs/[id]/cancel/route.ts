import { requireAdmin } from "@/lib/auth/admin";
import { json, route } from "@/lib/http";
import { cancelJob } from "@/server/jobs";

export const POST = route<{ id: string }>(async (req, { id }) => {
  const { admin } = await requireAdmin(req);
  return json({ job: await cancelJob(id, admin.id) });
});
