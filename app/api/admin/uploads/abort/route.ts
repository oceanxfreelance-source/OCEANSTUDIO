import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { json, parseJson, route } from "@/lib/http";
import { abortUpload } from "@/server/uploads";

export const POST = route(async (req) => {
  await requireAdmin(req);
  const { mediaId } = await parseJson(req, z.object({ mediaId: z.string().min(1).max(64) }));
  return json(await abortUpload(mediaId));
});
