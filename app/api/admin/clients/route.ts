import { requireAdmin } from "@/lib/auth/admin";
import { json, parseJson, route } from "@/lib/http";
import { clientInputSchema, createClient, listClients } from "@/server/clients";

export const GET = route(async (req) => {
  await requireAdmin(req);
  return json({ clients: await listClients() });
});

export const POST = route(async (req) => {
  const { admin } = await requireAdmin(req);
  return json({ client: await createClient(await parseJson(req, clientInputSchema), admin.id) }, 201);
});
