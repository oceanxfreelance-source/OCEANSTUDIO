import type { BookingStatus } from "@prisma/client";
import type { BadgeTone } from "@/components/admin/ui";
import { SLOT_LABEL } from "./shop-rules";
import { formatDate } from "./format";

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  NEW: "Requested",
  CONTACTED: "Requested",
  CONFIRMED: "Confirmed",
  FILMED: "Filmed",
  READY: "Ready to download",
  COMPLETED: "Delivered",
  DECLINED: "Declined",
  CANCELLED: "Cancelled",
};

/** Bookings that still take up a place in their session. */
export const ACTIVE_BOOKING: BookingStatus[] = ["NEW", "CONTACTED", "CONFIRMED", "FILMED", "READY", "COMPLETED"];

export function bookingLabel(b: { reference: string; fullName: string; preferredDate: Date | null; slot: keyof typeof SLOT_LABEL | null }): string {
  return `${b.reference} · ${b.fullName}${b.preferredDate ? ` · ${formatDate(b.preferredDate, { day: "numeric", month: "short" })}` : ""}${b.slot ? ` ${SLOT_LABEL[b.slot].toLowerCase()}` : ""}`;
}

export const BOOKING_TONE: Record<BookingStatus, BadgeTone> = { NEW: "blue", CONTACTED: "blue", CONFIRMED: "purple", FILMED: "amber", READY: "green", COMPLETED: "gray", DECLINED: "red", CANCELLED: "gray" };
export const PAY_LABEL: Record<string, [string, BadgeTone]> = { UNPAID: ["Unpaid", "red"], DEPOSIT: ["Deposit paid", "amber"], PAID: ["Paid", "green"], REFUNDED: ["Refunded", "gray"] };
