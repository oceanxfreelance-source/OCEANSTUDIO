import type { ActorType, Prisma } from "@prisma/client";
import { db } from "./db";
import { logger } from "./logger";

export type AuditAction =
  | "LOGIN"
  | "LOGIN_FAILED"
  | "LOGOUT"
  | "PROJECT_CREATED"
  | "PROJECT_UPDATED"
  | "PROJECT_ARCHIVED"
  | "PROJECT_DELETED"
  | "CLIENT_CREATED"
  | "CLIENT_UPDATED"
  | "FILE_UPLOADED"
  | "UPLOAD_REJECTED"
  | "PROCESSING_STARTED"
  | "PROCESSING_COMPLETED"
  | "PROCESSING_FAILED"
  | "PROCESSING_RETRIED"
  | "PROCESSING_CANCELLED"
  | "INTEGRITY_VERIFIED"
  | "INTEGRITY_ALERT"
  | "FILE_PUBLISHED"
  | "FILE_UNPUBLISHED"
  | "DELIVERY_CREATED"
  | "DELIVERY_READY"
  | "DELIVERY_REVOKED"
  | "DELIVERY_RENEWED"
  | "DELIVERY_EXPIRED"
  | "DELIVERY_DELETED"
  | "DELIVERY_CLEANUP_FAILED"
  | "CLIENT_LOGIN"
  | "CLIENT_LOGIN_FAILED"
  | "DOWNLOAD"
  | "ADMIN_DOWNLOAD"
  | "PACKAGE_CREATED"
  | "SETTINGS_UPDATED";

export interface AuditEntry {
  action: AuditAction;
  actorType: ActorType;
  actorId?: string | null;
  projectId?: string | null;
  deliveryId?: string | null;
  mediaId?: string | null;
  details?: Prisma.InputJsonValue;
  ipHash?: string | null;
}

/** Audit logging must never break the main operation; failures are logged loudly. */
export async function audit(entry: AuditEntry, tx: Prisma.TransactionClient = db): Promise<void> {
  try {
    await tx.auditLog.create({ data: entry });
  } catch (err) {
    logger.error({ err, entry }, "failed to write audit log");
  }
}
