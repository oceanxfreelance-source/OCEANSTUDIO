import { z } from "zod";
import { requireClient } from "@/lib/auth/client";
import { hashIp } from "@/lib/crypto";
import { clientIp, json, parseJson, route } from "@/lib/http";
import { enforce, RULES } from "@/lib/rate-limit";
import { clientDownload } from "@/server/deliveries";

const schema = z
  .object({ token: z.string().min(1).max(64), fileId: z.string().min(1).max(64).optional(), packageId: z.string().min(1).max(64).optional() })
  .refine((b) => Boolean(b.fileId) !== Boolean(b.packageId), "Specify exactly one of fileId or packageId");

/**
 * Returns a 5–15 minute signed URL for the EXACT published file. The gallery
 * lasts 48 hours; each download link is short-lived and re-checked here.
 */
export const POST = route(async (req) => {
  const body = await parseJson(req, schema);
  const { delivery, session } = await requireClient(req, body.token);
  const ip = hashIp(clientIp(req));
  await enforce(RULES.download, ip ?? session.id);
  return json(await clientDownload(delivery, { fileId: body.fileId, packageId: body.packageId }, { ipHash: ip, userAgent: req.headers.get("user-agent"), sessionId: session.id }));
});
