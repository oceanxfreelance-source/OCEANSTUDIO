/**
 * Object key layout. This module is the single source of truth for where
 * things live and — critically — which keys may ever be deleted.
 *
 *   projects/{projectId}/masters/{fileId}                 PERMANENT (immutable masters)
 *   projects/{projectId}/raw-previews/{fileId}.jpg        PERMANENT
 *   projects/{projectId}/previews/{fileId}/{variant}      PERMANENT
 *   projects/{projectId}/versions/{mediaId}/{versionId}   PERMANENT (derivatives)
 *   deliveries/{deliveryId}/files/{fileId}                TEMPORARY
 *   deliveries/{deliveryId}/previews/{fileId}/{variant}   TEMPORARY
 *   deliveries/{deliveryId}/packages/{packageId}.zip      TEMPORARY
 *   deliveries/{deliveryId}/manifest.json                 TEMPORARY
 *   uploads/{mediaId}                                     STAGING (validated, then promoted to masters/)
 *   processing/{jobId}/...                                SCRATCH (worker only)
 */

const ID_RE = /^[A-Za-z0-9_-]{6,64}$/;

function id(value: string, what: string): string {
  if (!ID_RE.test(value)) throw new Error(`Invalid ${what} for storage key: ${JSON.stringify(value)}`);
  return value;
}

export type PreviewVariant = "preview.jpg" | "thumb.jpg" | "detail.jpg" | "proxy.mp4" | "poster.jpg";

export const keys = {
  master: (projectId: string, fileId: string) => `projects/${id(projectId, "projectId")}/masters/${id(fileId, "fileId")}`,
  rawPreview: (projectId: string, fileId: string) =>
    `projects/${id(projectId, "projectId")}/raw-previews/${id(fileId, "fileId")}.jpg`,
  preview: (projectId: string, fileId: string, variant: PreviewVariant) =>
    `projects/${id(projectId, "projectId")}/previews/${id(fileId, "fileId")}/${variant}`,
  version: (projectId: string, mediaId: string, versionId: string) =>
    `projects/${id(projectId, "projectId")}/versions/${id(mediaId, "mediaId")}/${id(versionId, "versionId")}`,
  versionPreview: (projectId: string, versionId: string, variant: PreviewVariant) =>
    `projects/${id(projectId, "projectId")}/previews/versions/${id(versionId, "versionId")}/${variant}`,
  deliveryPrefix: (deliveryId: string) => `deliveries/${id(deliveryId, "deliveryId")}/`,
  deliveryFile: (deliveryId: string, fileId: string) =>
    `deliveries/${id(deliveryId, "deliveryId")}/files/${id(fileId, "fileId")}`,
  deliveryPreview: (deliveryId: string, fileId: string, variant: PreviewVariant) =>
    `deliveries/${id(deliveryId, "deliveryId")}/previews/${id(fileId, "fileId")}/${variant}`,
  deliveryPackage: (deliveryId: string, packageId: string) =>
    `deliveries/${id(deliveryId, "deliveryId")}/packages/${id(packageId, "packageId")}.zip`,
  deliveryManifest: (deliveryId: string) => `deliveries/${id(deliveryId, "deliveryId")}/manifest.json`,
  staging: (mediaId: string) => `uploads/${id(mediaId, "mediaId")}`,
  processing: (jobId: string, name: string) => {
    if (!/^[A-Za-z0-9._-]{1,128}$/.test(name)) throw new Error("Invalid scratch object name");
    return `processing/${id(jobId, "jobId")}/${name}`;
  },
};

export function isMasterKey(key: string): boolean {
  return /^projects\/[^/]+\/masters\//.test(key);
}

/** Any key under projects/ is permanent admin storage and can never be deleted by the application. */
export function isPermanentKey(key: string): boolean {
  return key.startsWith("projects/");
}

export class ProtectedKeyError extends Error {
  constructor(key: string, reason: string) {
    super(`Refusing to delete protected object "${key}": ${reason}`);
    this.name = "ProtectedKeyError";
  }
}

/**
 * Hard guard used by every delete path. Only objects inside the given delivery's
 * prefix, or worker scratch space, may be deleted.
 */
export type DeleteScope = { deliveryId: string } | { jobId: string } | { stagingMediaId: string };

export function assertDeletable(key: string, scope: DeleteScope): void {
  if (key.includes("..") || key.includes("//") || key.startsWith("/")) throw new ProtectedKeyError(key, "malformed key");
  if (isPermanentKey(key) || key.includes("/masters/")) throw new ProtectedKeyError(key, "permanent admin storage");
  if ("deliveryId" in scope) {
    const prefix = keys.deliveryPrefix(scope.deliveryId);
    if (!key.startsWith(prefix)) throw new ProtectedKeyError(key, `outside ${prefix}`);
  } else if ("stagingMediaId" in scope) {
    if (key !== keys.staging(scope.stagingMediaId)) throw new ProtectedKeyError(key, "not the staging object of this upload");
  } else {
    const prefix = `processing/${id(scope.jobId, "jobId")}/`;
    if (!key.startsWith(prefix)) throw new ProtectedKeyError(key, `outside ${prefix}`);
  }
}
