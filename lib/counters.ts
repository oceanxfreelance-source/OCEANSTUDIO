import type { Prisma } from "@prisma/client";

/** Next friendly reference, e.g. nextReference(tx, "booking", "OX-B") → "OX-B-00012". */
export async function nextReference(tx: Prisma.TransactionClient, name: string, prefix: string): Promise<string> {
  const c = await tx.counter.upsert({ where: { name }, create: { name, value: 1 }, update: { value: { increment: 1 } } });
  return `${prefix}-${String(c.value).padStart(5, "0")}`;
}
