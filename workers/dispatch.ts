import { db } from "@/lib/db";
import { runJob, type JobContext } from "./context";
import { prepareDelivery, packageDelivery } from "./handlers/delivery";
import { ingest } from "./handlers/ingest";
import { processPhoto } from "./handlers/photo";
import { verifyMaster } from "./handlers/verify";
import { processVideo } from "./handlers/video";
import type { JobType } from "@prisma/client";

const HANDLERS: Record<JobType, (ctx: JobContext) => Promise<void>> = {
  INGEST: ingest,
  RAW_DEVELOP: processPhoto,
  PHOTO_ENHANCE: processPhoto,
  COLOR_GRADE: processPhoto,
  VIDEO_ENHANCE: processVideo,
  VERIFY_MASTER: verifyMaster,
  DELIVERY_PREPARE: prepareDelivery,
  ZIP_PACKAGE: packageDelivery,
};

/** Execute one processing job by id (used by the BullMQ workers and by tests). */
export async function dispatch(processingJobId: string): Promise<void> {
  const job = await db.processingJob.findUnique({ where: { id: processingJobId }, select: { jobType: true } });
  if (!job) return;
  await runJob(processingJobId, HANDLERS[job.jobType]);
}
