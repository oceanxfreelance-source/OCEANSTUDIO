import { requireAdmin } from "@/lib/auth/admin";
import { json, parseJson, route } from "@/lib/http";
import { clientInputSchema, updateClient } from "@/server/clients";

export const PATCH = route<{ id: string }>(async (req, { id }) => {
  const { admin } = await requireAdmin(req);
  return json({ client: await updateClient(id, await parseJson(req, clientInputSchema.partial()), admin.id) });
});
