-- AlterTable
ALTER TABLE "deliveries" ADD COLUMN     "cleanup_locked_until" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "media_files" ADD COLUMN     "staging_key" TEXT;
