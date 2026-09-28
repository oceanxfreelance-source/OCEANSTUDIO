import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { json, parseQuery, route } from "@/lib/http";
import { listJobs } from "@/server/jobs";

const q = z.object({ status: z.enum(["QUEUED", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED"]).optional(), take: z.coerce.number().int().min(1).max(500).optional() });

export const GET = route(async (req) => {
  await requireAdmin(req);
  return json({ jobs: await listJobs(parseQuery(req, q)) });
});
