import { requireAdmin } from "@/lib/auth/admin";
import { json, route } from "@/lib/http";
import { getJob } from "@/server/jobs";

export const GET = route<{ id: string }>(async (req, { id }) => {
  await requireAdmin(req);
  return json({ job: await getJob(id) });
});
