import { requireAdmin } from "@/lib/auth/admin";
import { json, route } from "@/lib/http";
import { dashboardStats } from "@/server/stats";

export const GET = route(async (req) => {
  await requireAdmin(req);
  return json(await dashboardStats());
});
