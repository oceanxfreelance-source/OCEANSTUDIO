import { requireAdmin } from "@/lib/auth/admin";
import { json, parseJson, route } from "@/lib/http";
import { enforce, RULES } from "@/lib/rate-limit";
import { createUpload, createUploadSchema } from "@/server/uploads";

/** Initialise a direct-to-storage multipart upload. File bytes never pass through this server. */
export const POST = route(async (req) => {
  const { admin } = await requireAdmin(req);
  await enforce(RULES.uploadInit, admin.id);
  return json(await createUpload(await parseJson(req, createUploadSchema), admin.id), 201);
});
