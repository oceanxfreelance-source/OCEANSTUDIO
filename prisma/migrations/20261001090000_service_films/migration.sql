-- Portfolio videos can be shown on a service's page (e.g. many films on Drone Videography).
ALTER TABLE "portfolio_items" ADD COLUMN "service_id" TEXT;

CREATE INDEX "portfolio_items_service_id_published_idx" ON "portfolio_items"("service_id", "published");

ALTER TABLE "portfolio_items" ADD CONSTRAINT "portfolio_items_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Existing uploaded videos are drone films: show them on Drone Videography.
UPDATE "portfolio_items"
SET "service_id" = (SELECT "id" FROM "services" WHERE "slug" = 'drone-videography')
WHERE "video_url" IS NOT NULL AND "video_url" <> '';
