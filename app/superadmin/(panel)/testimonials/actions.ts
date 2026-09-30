"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkbox, fieldErrors, formToObject, idList, type FormState } from "@/lib/forms";
import { testimonialSchema } from "@/lib/validation";

export async function saveTestimonial(id: string | null, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = testimonialSchema.safeParse(formToObject(fd));
  if (!parsed.success) return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error.issues) };
  const v = parsed.data;
  const [avatarId] = idList(fd, "avatarId");
  const data = {
    name: v.name,
    instagram: v.instagram ?? null,
    text: v.text,
    date: v.date ?? null,
    avatarId: avatarId ?? null,
    featured: checkbox(fd, "featured"),
    published: checkbox(fd, "published"),
  };
  if (id) await db.testimonial.update({ where: { id }, data });
  else await db.testimonial.create({ data });
  revalidatePath("/", "layout");
  if (!id) redirect("/superadmin/testimonials");
  return { ok: true };
}

export async function deleteTestimonial(id: string) {
  await requireAdmin();
  await db.testimonial.delete({ where: { id } });
  revalidatePath("/", "layout");
  redirect("/superadmin/testimonials");
}
