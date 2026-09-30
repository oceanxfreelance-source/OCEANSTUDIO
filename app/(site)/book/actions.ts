"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createBookingRequest } from "@/lib/bookings";
import { fieldErrors, formToObject } from "@/lib/forms";
import { rateLimit } from "@/lib/rate-limit";
import { bookingRequestSchema } from "@/lib/validation";

export type BookingState =
  | { status: "idle" }
  | { status: "error"; error: string; fieldErrors?: Record<string, string>; values: Record<string, string> }
  | { status: "sent"; reference: string };

/** Public booking form handler. No account needed. */
export async function submitBooking(_prev: BookingState, formData: FormData): Promise<BookingState> {
  const values = formToObject(formData);

  // Honeypot: real people never see or fill this field.
  if (values.website) return { status: "sent", reference: "" };

  const parsed = bookingRequestSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", error: "Please check the highlighted fields.", fieldErrors: fieldErrors(parsed.error.issues), values };
  }

  // Max 6 valid requests per hour from one connection (stops spam floods).
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  if (!(await rateLimit(`booking:${ip}`, 6, 3600))) {
    return { status: "error", error: "You've sent several requests already. Please message us on Instagram or WhatsApp instead.", values };
  }

  try {
    const booking = await createBookingRequest(parsed.data);
    revalidatePath("/superadmin", "layout");
    return { status: "sent", reference: booking.reference };
  } catch (err) {
    console.error("booking failed", err);
    return { status: "error", error: "Something went wrong sending your request. Please try again, or message us directly.", values };
  }
}
