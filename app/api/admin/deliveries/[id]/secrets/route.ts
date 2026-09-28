import { requireAdmin } from "@/lib/auth/admin";
import { json, route } from "@/lib/http";
import { deliverySecrets } from "@/server/deliveries";

/** COPY LINK / COPY PASSWORD. Stored encrypted (AES-256-GCM); verification uses the scrypt hash. */
export const GET = route<{ id: string }>(async (req, { id }) => {
  await requireAdmin(req);
  return json(await deliverySecrets(id));
});
