import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { json, parseJson, route } from "@/lib/http";
import { enforce, RULES } from "@/lib/rate-limit";
import { queueBatchPhotoJobs, queuePhotoJob } from "@/server/media";

const body = z.union([
  z.object({ batch: z.literal(true), versionIds: z.array(z.string().min(1).max(64)).min(1).max(1000), settings: z.record(z.unknown()) }),
  z.object({ batch: z.literal(false).optional(), settings: z.record(z.unknown()) }),
]);

/** Queue RAW development, AI enhancement / upscale and/or color grading. Never runs in the request. */
export const POST = route(async (req) => {
  const { admin } = await requireAdmin(req);
  await enforce(RULES.processing, admin.id);
  const input = await parseJson(req, body);
  if (input.batch) {
    const { sourceVersionId: _ignored, ...template } = input.settings as Record<string, unknown>;
    const res = await queueBatchPhotoJobs(input.versionIds, template as never, admin.id);
    return json({ batchId: res.batchId, jobs: res.jobs.map((j) => ({ id: j.id, status: j.status })) }, 202);
  }
  const job = await queuePhotoJob(input.settings, admin.id);
  return json({ job }, 202);
});
