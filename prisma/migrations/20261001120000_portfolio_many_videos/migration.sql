-- A portfolio piece can hold many videos; video_url stays the main (first) one.
ALTER TABLE "portfolio_items" ADD COLUMN "video_urls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "portfolio_items"
SET "video_urls" = ARRAY["video_url"]
WHERE "video_url" IS NOT NULL AND "video_url" <> '';
