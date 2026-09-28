import { requireAdmin } from "@/lib/auth/admin";
import { json, route } from "@/lib/http";
import { revokeDelivery } from "@/server/deliveries";

export const POST = route<{ id: string }>(async (req, { id }) => {
  const { admin } = await requireAdmin(req);
  const d = await revokeDelivery(id, admin.id);
  return json({ id: d.id, status: d.status });
});
