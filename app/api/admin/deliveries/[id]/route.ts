import { requireAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { json, route } from "@/lib/http";
import { displayStatus } from "@/server/deliveries";

export const GET = route<{ id: string }>(async (req, { id }) => {
  await requireAdmin(req);
  const d = await db.delivery.findUnique({
    where: { id },
    include: {
      client: true,
      project: { select: { id: true, name: true } },
      files: { orderBy: { sortOrder: "asc" }, include: { _count: { select: { downloads: true, favorites: true } } } },
      packages: { orderBy: { partNumber: "asc" } },
      _count: { select: { downloads: true, favorites: true } },
    },
  });
  if (!d) throw notFound("Delivery not found");
  const { tokenCiphertext: _t, passwordCiphertext: _p, passwordHash: _h, secureTokenHash: _s, ...rest } = d;
  return json({ delivery: { ...rest, displayStatus: displayStatus(d) } });
});
