import { z } from "zod";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { notFound } from "@/lib/errors";

export const clientInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(254).optional().nullable().or(z.literal("").transform(() => null)),
  phone: z.string().trim().max(40).optional().nullable(),
  notes: z.string().trim().max(4000).optional().nullable(),
});

export function listClients() {
  return db.client.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { projects: true, deliveries: true } } },
  });
}

export async function createClient(input: z.infer<typeof clientInputSchema>, adminId: string) {
  const client = await db.client.create({ data: { name: input.name, email: input.email ?? null, phone: input.phone ?? null, notes: input.notes ?? null } });
  await audit({ action: "CLIENT_CREATED", actorType: "ADMIN", actorId: adminId, details: { clientId: client.id } });
  return client;
}

export async function updateClient(id: string, input: Partial<z.infer<typeof clientInputSchema>>, adminId: string) {
  if (!(await db.client.findUnique({ where: { id } }))) throw notFound("Client not found");
  const client = await db.client.update({ where: { id }, data: input });
  await audit({ action: "CLIENT_UPDATED", actorType: "ADMIN", actorId: adminId, details: { clientId: id } });
  return client;
}
