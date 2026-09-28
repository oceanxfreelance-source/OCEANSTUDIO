-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('OWNER', 'ADMIN');

-- CreateEnum
CREATE TYPE "SessionKind" AS ENUM ('ADMIN', 'CLIENT');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'PROCESSING', 'READY', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('PHOTO', 'RAW', 'VIDEO');

-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('UPLOADING', 'UPLOADED', 'INGESTING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "IntegrityStatus" AS ENUM ('UNVERIFIED', 'OK', 'MISMATCH');

-- CreateEnum
CREATE TYPE "VersionType" AS ENUM ('ORIGINAL', 'RAW_DEVELOPED', 'AI_ENHANCED', 'ENHANCED', 'UPSCALED', 'COLOR_GRADED', 'VIDEO_ENHANCED');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('INGEST', 'RAW_DEVELOP', 'PHOTO_ENHANCE', 'COLOR_GRADE', 'VIDEO_ENHANCE', 'VERIFY_MASTER', 'DELIVERY_PREPARE', 'ZIP_PACKAGE');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PREPARING', 'ACTIVE', 'EXPIRED', 'DELETING', 'DELETED', 'REVOKED', 'FAILED');

-- CreateEnum
CREATE TYPE "StorageCategory" AS ENUM ('MASTER', 'DERIVATIVE', 'PREVIEW', 'DELIVERY_FILE', 'DELIVERY_PREVIEW', 'DELIVERY_PACKAGE', 'DELIVERY_MANIFEST', 'PROCESSING_TEMP');

-- CreateEnum
CREATE TYPE "DownloadType" AS ENUM ('FILE', 'PACKAGE', 'ADMIN_MASTER', 'ADMIN_VERSION');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('ADMIN', 'CLIENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "PackageStatus" AS ENUM ('QUEUED', 'BUILDING', 'READY', 'FAILED', 'DELETED');

-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'ADMIN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" TIMESTAMP(3),
    "disabled_at" TIMESTAMP(3),

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "kind" "SessionKind" NOT NULL,
    "admin_user_id" TEXT,
    "delivery_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "last_seen_at" TIMESTAMP(3),
    "ip_hash" TEXT,
    "user_agent" TEXT,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "shoot_date" TIMESTAMP(3),
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "client_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_access" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_files" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "extension" TEXT NOT NULL,
    "media_type" "MediaType" NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" BIGINT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "duration" DOUBLE PRECISION,
    "fps" DOUBLE PRECISION,
    "codec" TEXT,
    "bitrate" BIGINT,
    "audio_codec" TEXT,
    "container" TEXT,
    "color_info" JSONB,
    "checksum" TEXT,
    "client_checksum" TEXT,
    "etag" TEXT,
    "storage_key" TEXT NOT NULL,
    "preview_key" TEXT,
    "thumb_key" TEXT,
    "detail_key" TEXT,
    "upload_id" TEXT,
    "status" "MediaStatus" NOT NULL DEFAULT 'UPLOADING',
    "is_master" BOOLEAN NOT NULL DEFAULT true,
    "integrity_status" "IntegrityStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "integrity_checked_at" TIMESTAMP(3),
    "error_message" TEXT,
    "captured_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploaded_at" TIMESTAMP(3),

    CONSTRAINT "media_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_metadata" (
    "id" TEXT NOT NULL,
    "media_id" TEXT NOT NULL,
    "camera_make" TEXT,
    "camera_model" TEXT,
    "lens" TEXT,
    "iso" INTEGER,
    "shutter" TEXT,
    "aperture" DOUBLE PRECISION,
    "focal_length" DOUBLE PRECISION,
    "face_regions" JSONB,
    "exif" JSONB,
    "raw" JSONB,
    "probe" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_versions" (
    "id" TEXT NOT NULL,
    "media_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "version_type" "VersionType" NOT NULL,
    "label" TEXT NOT NULL,
    "engine" TEXT,
    "is_ai" BOOLEAN NOT NULL DEFAULT false,
    "scale" INTEGER,
    "parent_version_id" TEXT,
    "processing_job_id" TEXT,
    "storage_key" TEXT NOT NULL,
    "preview_key" TEXT,
    "thumb_key" TEXT,
    "detail_key" TEXT,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" BIGINT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "duration" DOUBLE PRECISION,
    "bitrate" BIGINT,
    "fps" DOUBLE PRECISION,
    "checksum" TEXT,
    "settings" JSONB,
    "fidelity" JSONB,
    "is_master_ref" BOOLEAN NOT NULL DEFAULT false,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processing_jobs" (
    "id" TEXT NOT NULL,
    "media_id" TEXT,
    "project_id" TEXT,
    "delivery_id" TEXT,
    "source_version_id" TEXT,
    "output_version_id" TEXT,
    "batch_id" TEXT,
    "job_type" "JobType" NOT NULL,
    "settings" JSONB,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "stage" TEXT,
    "input_storage_key" TEXT,
    "output_storage_key" TEXT,
    "error_message" TEXT,
    "technical_log" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "processing_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processing_presets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "settings" JSONB NOT NULL,
    "built_in" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processing_presets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deliveries" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "project_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "secure_token_hash" TEXT NOT NULL,
    "token_ciphertext" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "password_ciphertext" TEXT NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PREPARING',
    "allow_favorites" BOOLEAN NOT NULL DEFAULT true,
    "watermark_previews" BOOLEAN NOT NULL DEFAULT false,
    "manifest" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "expired_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "cleanup_attempts" INTEGER NOT NULL DEFAULT 0,
    "last_cleanup_error" TEXT,
    "created_by" TEXT,
    "renewed_from_id" TEXT,

    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_files" (
    "id" TEXT NOT NULL,
    "delivery_id" TEXT NOT NULL,
    "media_id" TEXT NOT NULL,
    "version_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "media_type" "MediaType" NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" BIGINT NOT NULL,
    "checksum" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "duration" DOUBLE PRECISION,
    "storage_key" TEXT NOT NULL,
    "preview_key" TEXT,
    "thumb_key" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "copied_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_packages" (
    "id" TEXT NOT NULL,
    "delivery_id" TEXT NOT NULL,
    "part_number" INTEGER NOT NULL,
    "total_parts" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "size" BIGINT NOT NULL DEFAULT 0,
    "file_count" INTEGER NOT NULL DEFAULT 0,
    "status" "PackageStatus" NOT NULL DEFAULT 'QUEUED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storage_objects" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "category" "StorageCategory" NOT NULL,
    "size" BIGINT NOT NULL DEFAULT 0,
    "temporary" BOOLEAN NOT NULL DEFAULT false,
    "project_id" TEXT,
    "media_id" TEXT,
    "version_id" TEXT,
    "delivery_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "storage_objects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "downloads" (
    "id" TEXT NOT NULL,
    "delivery_id" TEXT,
    "delivery_file_id" TEXT,
    "package_id" TEXT,
    "media_id" TEXT,
    "version_id" TEXT,
    "download_type" "DownloadType" NOT NULL,
    "label" TEXT,
    "ip_hash" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "downloads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorites" (
    "id" TEXT NOT NULL,
    "delivery_id" TEXT NOT NULL,
    "delivery_file_id" TEXT NOT NULL,
    "media_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "watermarks" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "opacity" DOUBLE PRECISION NOT NULL DEFAULT 0.35,
    "position" TEXT NOT NULL DEFAULT 'center',
    "scale" DOUBLE PRECISION NOT NULL DEFAULT 0.05,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "watermarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor_type" "ActorType" NOT NULL,
    "actor_id" TEXT,
    "project_id" TEXT,
    "delivery_id" TEXT,
    "media_id" TEXT,
    "details" JSONB,
    "ip_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_delivery_id_idx" ON "sessions"("delivery_id");

-- CreateIndex
CREATE INDEX "sessions_admin_user_id_idx" ON "sessions"("admin_user_id");

-- CreateIndex
CREATE INDEX "projects_status_idx" ON "projects"("status");

-- CreateIndex
CREATE UNIQUE INDEX "project_access_project_id_client_id_key" ON "project_access"("project_id", "client_id");

-- CreateIndex
CREATE UNIQUE INDEX "media_files_storage_key_key" ON "media_files"("storage_key");

-- CreateIndex
CREATE INDEX "media_files_project_id_idx" ON "media_files"("project_id");

-- CreateIndex
CREATE INDEX "media_files_status_idx" ON "media_files"("status");

-- CreateIndex
CREATE UNIQUE INDEX "media_metadata_media_id_key" ON "media_metadata"("media_id");

-- CreateIndex
CREATE UNIQUE INDEX "media_versions_processing_job_id_key" ON "media_versions"("processing_job_id");

-- CreateIndex
CREATE INDEX "media_versions_project_id_published_idx" ON "media_versions"("project_id", "published");

-- CreateIndex
CREATE UNIQUE INDEX "media_versions_media_id_version_number_key" ON "media_versions"("media_id", "version_number");

-- CreateIndex
CREATE INDEX "processing_jobs_status_idx" ON "processing_jobs"("status");

-- CreateIndex
CREATE INDEX "processing_jobs_media_id_idx" ON "processing_jobs"("media_id");

-- CreateIndex
CREATE INDEX "processing_jobs_batch_id_idx" ON "processing_jobs"("batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "processing_presets_kind_name_key" ON "processing_presets"("kind", "name");

-- CreateIndex
CREATE UNIQUE INDEX "deliveries_secure_token_hash_key" ON "deliveries"("secure_token_hash");

-- CreateIndex
CREATE INDEX "deliveries_status_expires_at_idx" ON "deliveries"("status", "expires_at");

-- CreateIndex
CREATE INDEX "delivery_files_delivery_id_idx" ON "delivery_files"("delivery_id");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_files_delivery_id_version_id_key" ON "delivery_files"("delivery_id", "version_id");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_packages_delivery_id_part_number_key" ON "delivery_packages"("delivery_id", "part_number");

-- CreateIndex
CREATE UNIQUE INDEX "storage_objects_key_key" ON "storage_objects"("key");

-- CreateIndex
CREATE INDEX "storage_objects_category_deleted_at_idx" ON "storage_objects"("category", "deleted_at");

-- CreateIndex
CREATE INDEX "storage_objects_delivery_id_idx" ON "storage_objects"("delivery_id");

-- CreateIndex
CREATE INDEX "downloads_delivery_id_idx" ON "downloads"("delivery_id");

-- CreateIndex
CREATE INDEX "downloads_media_id_idx" ON "downloads"("media_id");

-- CreateIndex
CREATE INDEX "downloads_created_at_idx" ON "downloads"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_delivery_id_delivery_file_id_key" ON "favorites"("delivery_id", "delivery_file_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_access" ADD CONSTRAINT "project_access_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_access" ADD CONSTRAINT "project_access_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_metadata" ADD CONSTRAINT "media_metadata_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_versions" ADD CONSTRAINT "media_versions_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_versions" ADD CONSTRAINT "media_versions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_versions" ADD CONSTRAINT "media_versions_parent_version_id_fkey" FOREIGN KEY ("parent_version_id") REFERENCES "media_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "deliveries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_files" ADD CONSTRAINT "delivery_files_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_files" ADD CONSTRAINT "delivery_files_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "media_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_packages" ADD CONSTRAINT "delivery_packages_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "downloads" ADD CONSTRAINT "downloads_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "deliveries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "downloads" ADD CONSTRAINT "downloads_delivery_file_id_fkey" FOREIGN KEY ("delivery_file_id") REFERENCES "delivery_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "downloads" ADD CONSTRAINT "downloads_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "delivery_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_delivery_file_id_fkey" FOREIGN KEY ("delivery_file_id") REFERENCES "delivery_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
