"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkbox, fieldErrors, formToObject, idList, type FormState } from "@/lib/forms";
import { uniqueSlug } from "@/lib/slug";
import { locationSchema } from "@/lib/validation";

export async function saveLocation(id: string | null, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = locationSchema.safeParse(formToObject(fd));
  if (!parsed.success) return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error.issues) };
  const v = parsed.data;
  const [coverId] = idList(fd, "coverId");
  const imageIds = idList(fd, "imageIds");
  const data = {
    name: v.name,
    kind: v.kind,
    atoll: v.atoll,
    description: v.description,
    videoUrl: v.videoUrl ?? null,
    displayOrder: v.displayOrder ?? 0,
    featured: checkbox(fd, "featured"),
    published: checkbox(fd, "published"),
    coverId: coverId ?? null,
  };

  let savedId = id;
  if (id) {
    await db.$transaction([
      db.location.update({ where: { id }, data }),
      db.locationImage.deleteMany({ where: { locationId: id } }),
      db.locationImage.createMany({ data: imageIds.map((mediaId, position) => ({ locationId: id, mediaId, position })) }),
    ]);
  } else {
    const slug = await uniqueSlug(v.name, async (s) => !!(await db.location.findUnique({ where: { slug: s } })));
    const created = await db.location.create({ data: { ...data, slug, images: { create: imageIds.map((mediaId, position) => ({ mediaId, position })) } } });
    savedId = created.id;
  }
  revalidatePath("/", "layout");
  if (!id) redirect(`/superadmin/locations/${savedId}?created=1`);
  return { ok: true, message: "Location saved." };
}

export async function deleteLocation(id: string) {
  await requireAdmin();
  await db.location.delete({ where: { id } });
  revalidatePath("/", "layout");
  redirect("/superadmin/locations");
}

export async function toggleLocation(id: string, field: "published" | "featured") {
  await requireAdmin();
  const l = await db.location.findUniqueOrThrow({ where: { id }, select: { published: true, featured: true } });
  await db.location.update({ where: { id }, data: { [field]: !l[field] } });
  revalidatePath("/", "layout");
}
