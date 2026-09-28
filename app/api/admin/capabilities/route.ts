import { requireAdmin } from "@/lib/auth/admin";
import { json, route } from "@/lib/http";
import { capabilities } from "@/server/capabilities";

export const GET = route(async (req) => {
  await requireAdmin(req);
  return json(capabilities());
});
