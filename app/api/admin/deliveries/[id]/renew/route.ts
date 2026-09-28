import { requireAdmin } from "@/lib/auth/admin";
import { json, route } from "@/lib/http";
import { renewDelivery } from "@/server/deliveries";

/** CREATE NEW 48-HOUR DELIVERY from the same permanent versions — no re-upload. */
export const POST = route<{ id: string }>(async (req, { id }) => {
  const { admin } = await requireAdmin(req);
  const res = await renewDelivery(id, admin.id);
  return json({ deliveryId: res.delivery.id, expiresAt: res.delivery.expiresAt, link: res.link, password: res.password }, 201);
});
