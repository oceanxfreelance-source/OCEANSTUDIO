"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { fieldErrors, formToObject } from "@/lib/forms";
import { rateLimit } from "@/lib/rate-limit";
import { reviewSchema } from "@/lib/validation";

export type ReviewState =
  | { status: "idle" }
  | { status: "error"; error: string; fieldErrors?: Record<string, string>; values: Record<string, string> }
  | { status: "sent" };

/**
 * Public "leave a review" form. No account needed. Reviews are saved as
 * pending and only appear on the site after the admin approves them.
 */
export async function submitReview(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const values = formToObject(formData);
  if (values.website) return { status: "sent" }; // honeypot: bots fill hidden fields

  const parsed = reviewSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", error: "Please check the highlighted fields.", fieldErrors: fieldErrors(parsed.error.issues), values };
  }

  // At most 3 reviews per hour from one connection.
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  if (!(await rateLimit(`review:${ip}`, 3, 3600))) {
    return { status: "error", error: "You've already sent a few reviews — thank you! Please try again later.", values };
  }

  const v = parsed.data;
  await db.testimonial.create({
    data: { name: v.name, instagram: v.instagram ?? null, rating: v.rating, text: v.text, source: "guest", pending: true, published: false, featured: false },
  });
  revalidatePath("/superadmin", "layout");
  return { status: "sent" };
}
