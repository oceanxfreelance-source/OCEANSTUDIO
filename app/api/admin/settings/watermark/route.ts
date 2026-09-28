import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db";
import { json, parseJson, route } from "@/lib/http";

const schema = z.object({
  text: z.string().trim().min(1).max(80),
  opacity: z.number().min(0.05).max(0.9),
  position: z.enum(["center", "bottom-right", "tiled"]),
  scale: z.number().min(0.02).max(0.2),
});

export const GET = route(async (req) => {
  await requireAdmin(req);
  return json({ watermark: await db.watermark.findFirst({ where: { isDefault: true } }) });
});

export const PUT = route(async (req) => {
  const { admin } = await requireAdmin(req);
  const input = await parseJson(req, schema);
  const existing = await db.watermark.findFirst({ where: { isDefault: true } });
  const watermark = existing
    ? await db.watermark.update({ where: { id: existing.id }, data: input })
    : await db.watermark.create({ data: { ...input, isDefault: true } });
  await audit({ action: "SETTINGS_UPDATED", actorType: "ADMIN", actorId: admin.id, details: { watermark: input } });
  return json({ watermark });
});
