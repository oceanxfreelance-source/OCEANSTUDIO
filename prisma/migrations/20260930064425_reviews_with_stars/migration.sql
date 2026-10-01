-- AlterTable
ALTER TABLE "testimonials" ADD COLUMN     "pending" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rating" INTEGER,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'admin';

-- CreateIndex
CREATE INDEX "testimonials_published_pending_idx" ON "testimonials"("published", "pending");
