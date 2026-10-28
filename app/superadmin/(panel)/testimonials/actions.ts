"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkbox, fieldErrors, formToObject, idList, type FormState } from "@/lib/forms";
import { testimonialSchema } from "@/lib/validation";

/** Admin: add or edit a review. */
export async function saveTestimonial(id: string | null, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = testimonialSchema.safeParse(formToObject(fd));
  if (!parsed.success) return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error.issues) };
  const v = parsed.data;
  const [avatarId] = idList(fd, "avatarId");
  const published = checkbox(fd, "published");
  const data = {
    name: v.name,
    instagram: v.instagram ?? null,
    text: v.text,
    rating: v.rating ?? null,
    date: v.date ?? null,
    avatarId: avatarId ?? null,
    featured: checkbox(fd, "featured"),
    published,
    pending: false, // saving from the admin counts as reviewed
  };
  if (id) await db.testimonial.update({ where: { id }, data });
  else await db.testimonial.create({ data });
  revalidatePath("/", "layout");
  if (!id) redirect("/superadmin/testimonials");
  return { ok: true };
}

/** One-tap moderation from the list: approve (show on site) or hide. */
export async function setReviewVisibility(id: string, visible: boolean) {
  await requireAdmin();
  await db.testimonial.update({ where: { id }, data: { published: visible, pending: false } });
  revalidatePath("/", "layout");
}

export async function toggleReviewFeatured(id: string) {
  await requireAdmin();
  const r = await db.testimonial.findUniqueOrThrow({ where: { id }, select: { featured: true } });
  await db.testimonial.update({ where: { id }, data: { featured: !r.featured } });
  revalidatePath("/", "layout");
}

export async function deleteTestimonial(id: string, back = true) {
  await requireAdmin();
  await db.testimonial.delete({ where: { id } });
  revalidatePath("/", "layout");
  if (back) redirect("/superadmin/testimonials");
}
