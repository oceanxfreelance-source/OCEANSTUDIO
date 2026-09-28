import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { verifyMasterIntegrity, type JobContext } from "../context";

/** Admin-triggered full SHA-256 verification of a master (any size). */
export async function verifyMaster(ctx: JobContext): Promise<void> {
  const media = await db.mediaFile.findUniqueOrThrow({ where: { id: ctx.job.mediaId! } });
  await ctx.progress(0.1, "Hashing master");
  await verifyMasterIntegrity(media.id, ctx.log, { fullHashMaxBytes: Number.MAX_SAFE_INTEGER });
  await audit({ action: "INTEGRITY_VERIFIED", actorType: "SYSTEM", projectId: media.projectId, mediaId: media.id, details: { checksum: media.checksum } });
}
