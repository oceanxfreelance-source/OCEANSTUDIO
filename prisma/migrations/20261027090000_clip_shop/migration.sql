-- Clip shop: clips with private originals + public previews, orders, filming bookings, slips, availability.
-- CreateEnum
CREATE TYPE "DaySlot" AS ENUM ('MORNING', 'MIDDAY', 'AFTERNOON');

-- CreateEnum
CREATE TYPE "BookingPackage" AS ENUM ('SESSION', 'SESSION_REEL', 'DRONE_CAMERA');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'PAYPAL', 'CARD');

-- CreateEnum
CREATE TYPE "ClipStatus" AS ENUM ('PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('AWAITING_PAYMENT', 'PAID', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderPackage" AS ENUM ('CLIPS', 'SESSION', 'SESSION_REEL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BookingStatus" ADD VALUE 'FILMED';
ALTER TYPE "BookingStatus" ADD VALUE 'READY';
ALTER TYPE "BookingStatus" ADD VALUE 'DECLINED';

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "change_note" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "confirmed_at" TIMESTAMP(3),
ADD COLUMN     "deposit" DECIMAL(10,2),
ADD COLUMN     "downloads_until" TIMESTAMP(3),
ADD COLUMN     "package" "BookingPackage",
ADD COLUMN     "partner_ref" TEXT,
ADD COLUMN     "payment_method" "PaymentMethod",
ADD COLUMN     "recognition" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "slot" "DaySlot",
ADD COLUMN     "token" TEXT;

-- AlterTable
ALTER TABLE "locations" ADD COLUMN     "code" TEXT;

-- CreateTable
CREATE TABLE "availability" (
    "date" DATE NOT NULL,
    "slot" "DaySlot" NOT NULL,
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "max_bookings" INTEGER,

    CONSTRAINT "availability_pkey" PRIMARY KEY ("date","slot")
);

-- CreateTable
CREATE TABLE "clips" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "slot" "DaySlot" NOT NULL,
    "location_id" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "original_key" TEXT NOT NULL,
    "original_name" TEXT NOT NULL DEFAULT '',
    "original_size" INTEGER NOT NULL DEFAULT 0,
    "preview_url" TEXT,
    "poster_url" TEXT,
    "seconds" DOUBLE PRECISION,
    "status" "ClipStatus" NOT NULL DEFAULT 'PROCESSING',
    "error" TEXT,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "booking_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "whatsapp" TEXT,
    "email" TEXT,
    "payment_method" "PaymentMethod" NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'AWAITING_PAYMENT',
    "total" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "note" TEXT NOT NULL DEFAULT '',
    "partner_ref" TEXT,
    "paid_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "downloads_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_sessions" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "slot" "DaySlot" NOT NULL,
    "location_id" TEXT,
    "package" "OrderPackage" NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "order_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "clip_id" TEXT,
    "clip_code" TEXT NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_slips" (
    "id" TEXT NOT NULL,
    "order_id" TEXT,
    "booking_id" TEXT,
    "key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_slips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_files" (
    "id" TEXT NOT NULL,
    "order_id" TEXT,
    "booking_id" TEXT,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "size" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clips_code_key" ON "clips"("code");

-- CreateIndex
CREATE INDEX "clips_status_hidden_booking_id_date_idx" ON "clips"("status", "hidden", "booking_id", "date");

-- CreateIndex
CREATE INDEX "clips_date_slot_location_id_idx" ON "clips"("date", "slot", "location_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_reference_key" ON "orders"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "orders_token_key" ON "orders"("token");

-- CreateIndex
CREATE INDEX "orders_status_created_at_idx" ON "orders"("status", "created_at");

-- CreateIndex
CREATE INDEX "order_sessions_order_id_idx" ON "order_sessions"("order_id");

-- CreateIndex
CREATE INDEX "order_items_clip_id_idx" ON "order_items"("clip_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_items_session_id_clip_id_key" ON "order_items"("session_id", "clip_id");

-- CreateIndex
CREATE INDEX "payment_slips_order_id_idx" ON "payment_slips"("order_id");

-- CreateIndex
CREATE INDEX "payment_slips_booking_id_idx" ON "payment_slips"("booking_id");

-- CreateIndex
CREATE INDEX "delivery_files_order_id_idx" ON "delivery_files"("order_id");

-- CreateIndex
CREATE INDEX "delivery_files_booking_id_idx" ON "delivery_files"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_token_key" ON "bookings"("token");

-- CreateIndex
CREATE INDEX "bookings_preferred_date_slot_idx" ON "bookings"("preferred_date", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "locations_code_key" ON "locations"("code");

-- AddForeignKey
ALTER TABLE "clips" ADD CONSTRAINT "clips_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clips" ADD CONSTRAINT "clips_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_sessions" ADD CONSTRAINT "order_sessions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_sessions" ADD CONSTRAINT "order_sessions_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "order_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_clip_id_fkey" FOREIGN KEY ("clip_id") REFERENCES "clips"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_slips" ADD CONSTRAINT "payment_slips_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_slips" ADD CONSTRAINT "payment_slips_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_files" ADD CONSTRAINT "delivery_files_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_files" ADD CONSTRAINT "delivery_files_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Machines gets the clip code MC (clip codes look like MC-2710-07).
UPDATE "locations" SET "code" = 'MC' WHERE "slug" = 'machines' AND "code" IS NULL;
