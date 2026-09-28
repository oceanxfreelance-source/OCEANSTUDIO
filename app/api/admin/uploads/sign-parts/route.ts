import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { json, parseJson, route } from "@/lib/http";
import { signParts } from "@/server/uploads";

const schema = z.object({ mediaId: z.string().min(1).max(64), partNumbers: z.array(z.number().int().min(1).max(10000)).min(1).max(100) });

export const POST = route(async (req) => {
  await requireAdmin(req);
  const { mediaId, partNumbers } = await parseJson(req, schema);
  return json(await signParts(mediaId, partNumbers));
});
