"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkbox, fieldErrors, formToObject, idList, type FormState } from "@/lib/forms";
import { uniqueSlug } from "@/lib/slug";
import { serviceSchema } from "@/lib/validation";

/** Create (id = null) or update a service. */
export async function saveService(id: string | null, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = serviceSchema.safeParse(formToObject(fd));
  if (!parsed.success) return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error.issues) };
  const v = parsed.data;
  const [coverId] = idList(fd, "coverId");
  const imageIds = idList(fd, "imageIds");

  const data = {
    name: v.name,
    shortDescription: v.shortDescription,
    description: v.description,
    status: v.status,
    price: v.price ?? null,
    priceType: v.priceType,
    currency: v.currency,
    displayOrder: v.displayOrder ?? 0,
    featured: checkbox(fd, "featured"),
    published: checkbox(fd, "published"),
    coverId: coverId ?? null,
  };

  let savedId = id;
  if (id) {
    await db.$transaction([
      db.service.update({ where: { id }, data }),
      db.serviceImage.deleteMany({ where: { serviceId: id } }),
      db.serviceImage.createMany({ data: imageIds.map((mediaId, position) => ({ serviceId: id, mediaId, position })) }),
    ]);
  } else {
    const slug = await uniqueSlug(v.name, async (s) => !!(await db.service.findUnique({ where: { slug: s } })));
    const created = await db.service.create({
      data: { ...data, slug, images: { create: imageIds.map((mediaId, position) => ({ mediaId, position })) } },
    });
    savedId = created.id;
  }

  revalidatePath("/", "layout");
  if (!id) redirect(`/superadmin/services/${savedId}?created=1`);
  return { ok: true, message: "Service saved. The website is updated." };
}

export async function deleteService(id: string) {
  await requireAdmin();
  await db.service.delete({ where: { id } });
  revalidatePath("/", "layout");
  redirect("/superadmin/services");
}

/** Quick status change from the list (e.g. Coming soon → Active). */
export async function setServiceStatus(id: string, status: "ACTIVE" | "COMING_SOON" | "HIDDEN") {
  await requireAdmin();
  await db.service.update({ where: { id }, data: { status } });
  revalidatePath("/", "layout");
}
