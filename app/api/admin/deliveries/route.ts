import { requireAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db";
import { json, parseJson, route } from "@/lib/http";
import { createDelivery, createDeliverySchema, displayStatus } from "@/server/deliveries";

export const GET = route(async (req) => {
  await requireAdmin(req);
  const deliveries = await db.delivery.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    include: { client: { select: { id: true, name: true } }, project: { select: { id: true, name: true } }, _count: { select: { files: true, downloads: true, favorites: true } } },
  });
  return json({
    deliveries: deliveries.map(({ tokenCiphertext: _t, passwordCiphertext: _p, passwordHash: _h, secureTokenHash: _s, ...d }) => ({ ...d, displayStatus: displayStatus(d) })),
  });
});

/** Returns the link and password ONCE in the response; afterwards they are only available via /secrets. */
export const POST = route(async (req) => {
  const { admin } = await requireAdmin(req);
  const res = await createDelivery(await parseJson(req, createDeliverySchema), admin.id);
  return json({ deliveryId: res.delivery.id, expiresAt: res.delivery.expiresAt, link: res.link, password: res.password }, 201);
});
