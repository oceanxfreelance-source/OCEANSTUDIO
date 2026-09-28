import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { json, parseJson, route } from "@/lib/http";
import { setPublished } from "@/server/media";

export const POST = route<{ id: string }>(async (req, { id }) => {
  const { admin } = await requireAdmin(req);
  const { published } = await parseJson(req, z.object({ published: z.boolean() }));
  return json({ version: await setPublished(id, published, admin.id) });
});
