import type { Prisma, StorageCategory } from "@prisma/client";
import { db } from "@/lib/db";

export interface RegisterObject {
  key: string;
  category: StorageCategory;
  size: number | bigint;
  temporary?: boolean;
  projectId?: string | null;
  mediaId?: string | null;
  versionId?: string | null;
  deliveryId?: string | null;
}

const TEMPORARY: StorageCategory[] = ["DELIVERY_FILE", "DELIVERY_PREVIEW", "DELIVERY_PACKAGE", "DELIVERY_MANIFEST", "PROCESSING_TEMP"];

/** Every object the application writes is registered, so storage usage and cleanup are auditable. */
export async function registerObject(o: RegisterObject, tx: Prisma.TransactionClient = db) {
  const temporary = o.temporary ?? TEMPORARY.includes(o.category);
  if (temporary && !o.key.startsWith("deliveries/") && !o.key.startsWith("processing/")) {
    throw new Error(`Temporary objects must live under deliveries/ or processing/: ${o.key}`);
  }
  if (!temporary && o.key.startsWith("deliveries/")) throw new Error(`Delivery objects must be temporary: ${o.key}`);
  const data = { ...o, size: BigInt(o.size), temporary, deletedAt: null };
  await tx.storageObject.upsert({ where: { key: o.key }, create: data, update: data });
}
