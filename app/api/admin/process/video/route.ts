import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { json, parseJson, route } from "@/lib/http";
import { enforce, RULES } from "@/lib/rate-limit";
import { queueVideoJob } from "@/server/media";

export const POST = route(async (req) => {
  const { admin } = await requireAdmin(req);
  await enforce(RULES.processing, admin.id);
  const { settings } = await parseJson(req, z.object({ settings: z.record(z.unknown()) }));
  return json({ job: await queueVideoJob(settings, admin.id) }, 202);
});
