-- "Remove my clip" requests.
-- CreateTable
CREATE TABLE "removal_requests" (
    "id" TEXT NOT NULL,
    "clip_code" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "contact" TEXT NOT NULL DEFAULT '',
    "clip_id" TEXT,
    "done_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "removal_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "removal_requests_done_at_created_at_idx" ON "removal_requests"("done_at", "created_at");

