import "server-only";
import type { Prisma } from "@prisma/client";

/** Find the customer by WhatsApp or email, or create one — keeps the private customer list tidy. */
export async function findOrCreateCustomer(tx: Prisma.TransactionClient, c: { name: string; whatsapp?: string | null; email?: string | null; instagram?: string | null }) {
  const digits = c.whatsapp?.replace(/\D/g, "") ?? "";
  const or: Prisma.CustomerWhereInput[] = [];
  if (c.email) or.push({ email: { equals: c.email, mode: "insensitive" } });
  if (digits.length >= 6) or.push({ whatsapp: { contains: digits.slice(-7) } });
  const existing = or.length ? await tx.customer.findFirst({ where: { OR: or }, orderBy: { createdAt: "asc" } }) : null;
  if (existing) {
    return tx.customer.update({
      where: { id: existing.id },
      data: { whatsapp: existing.whatsapp ?? c.whatsapp ?? null, email: existing.email ?? c.email ?? null },
    });
  }
  return tx.customer.create({ data: { name: c.name, whatsapp: c.whatsapp || null, email: c.email || null, instagram: c.instagram || null } });
}
