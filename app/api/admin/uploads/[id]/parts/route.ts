import { requireAdmin } from "@/lib/auth/admin";
import { json, route } from "@/lib/http";
import { uploadedParts } from "@/server/uploads";

/** Resume support: parts already stored for an in-progress upload. */
export const GET = route<{ id: string }>(async (req, { id }) => {
  await requireAdmin(req);
  return json(await uploadedParts(id));
});
