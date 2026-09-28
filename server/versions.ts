import type { Prisma, VersionType } from "@prisma/client";
import { db } from "@/lib/db";

export interface NewVersion {
  id: string;
  mediaId: string;
  projectId: string;
  versionType: VersionType;
  label: string;
  engine?: string | null;
  isAi?: boolean;
  scale?: number | null;
  parentVersionId?: string | null;
  processingJobId?: string | null;
  storageKey: string;
  previewKey?: string | null;
  thumbKey?: string | null;
  detailKey?: string | null;
  filename: string;
  mimeType: string;
  size: bigint | number;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
  bitrate?: bigint | number | null;
  fps?: number | null;
  checksum?: string | null;
  settings?: Prisma.InputJsonValue;
  fidelity?: Prisma.InputJsonValue;
  isMasterRef?: boolean;
}

/**
 * Insert a version with the next version number. Idempotent per processing job:
 * a retried job that already produced its version returns the existing row, so
 * retries never create duplicates.
 */
export async function createVersion(v: NewVersion) {
  if (v.processingJobId) {
    const existing = await db.mediaVersion.findUnique({ where: { processingJobId: v.processingJobId } });
    if (existing) return existing;
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        const last = await tx.mediaVersion.findFirst({ where: { mediaId: v.mediaId }, orderBy: { versionNumber: "desc" }, select: { versionNumber: true } });
        return tx.mediaVersion.create({
          data: {
            ...v,
            size: BigInt(v.size),
            bitrate: v.bitrate !== null && v.bitrate !== undefined ? BigInt(v.bitrate) : null,
            versionNumber: (last?.versionNumber ?? 0) + 1,
          },
        });
      });
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code !== "P2002" || attempt === 4) throw err;
    }
  }
  throw new Error("unreachable");
}
