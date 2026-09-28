import { requireAdmin } from "@/lib/auth/admin";
import { hashIp } from "@/lib/crypto";
import { clientIp, json, parseJson, route } from "@/lib/http";
import { completeUpload, completeUploadSchema } from "@/server/uploads";

export const POST = route(async (req) => {
  const { admin } = await requireAdmin(req);
  return json(await completeUpload(await parseJson(req, completeUploadSchema), admin.id, hashIp(clientIp(req))));
});
