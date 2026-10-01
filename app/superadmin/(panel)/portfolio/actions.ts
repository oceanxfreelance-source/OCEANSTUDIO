"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkbox, fieldErrors, formToObject, idList, type FormState } from "@/lib/forms";
import { uniqueSlug } from "@/lib/slug";
import { deleteVideoIfUnused } from "@/lib/video-storage";
import { portfolioSchema, videoUrlList } from "@/lib/validation";

export async function savePortfolioItem(id: string | null, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = portfolioSchema.safeParse(formToObject(fd));
  if (!parsed.success) return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error.issues) };
  const v = parsed.data;
  const videos = videoUrlList.safeParse([...new Set(fd.getAll("videoUrls").filter((x): x is string => typeof x === "string" && !!x.trim()))]);
  if (!videos.success) return { error: "Please fix the highlighted fields.", fieldErrors: { videoUrls: videos.error.issues[0]?.message ?? "Invalid video" } };
  const [coverId] = idList(fd, "coverId");
  const imageIds = idList(fd, "imageIds");
  const locationId = v.locationId && (await db.location.findUnique({ where: { id: v.locationId } })) ? v.locationId : null;
  const serviceId = v.serviceId && (await db.service.findUnique({ where: { id: v.serviceId } })) ? v.serviceId : null;

  const data = {
    title: v.title,
    description: v.description,
    category: v.category,
    locationId,
    serviceId,
    date: v.date ?? null,
    videoUrl: videos.data[0] ?? null,
    videoUrls: videos.data,
    displayOrder: v.displayOrder ?? 0,
    featured: checkbox(fd, "featured"),
    published: checkbox(fd, "published"),
    coverId: coverId ?? null,
  };

  let savedId = id;
  if (id) {
    const before = await db.portfolioItem.findUnique({ where: { id }, select: { videoUrl: true, videoUrls: true } });
    await db.$transaction([
      db.portfolioItem.update({ where: { id }, data }),
      db.portfolioImage.deleteMany({ where: { itemId: id } }),
      db.portfolioImage.createMany({ data: imageIds.map((mediaId, position) => ({ itemId: id, mediaId, position })) }),
    ]);
    // Delete uploads that were removed from this piece.
    for (const old of new Set([...(before?.videoUrls ?? []), before?.videoUrl])) if (old && !data.videoUrls.includes(old)) await deleteVideoIfUnused(old);
  } else {
    const slug = await uniqueSlug(v.title, async (s) => !!(await db.portfolioItem.findUnique({ where: { slug: s } })));
    const created = await db.portfolioItem.create({ data: { ...data, slug, images: { create: imageIds.map((mediaId, position) => ({ mediaId, position })) } } });
    savedId = created.id;
  }
  revalidatePath("/", "layout");
  if (!id) redirect(`/superadmin/portfolio/${savedId}?created=1`);
  return { ok: true, message: "Saved. The portfolio is updated." };
}

export async function deletePortfolioItem(id: string) {
  await requireAdmin();
  const item = await db.portfolioItem.delete({ where: { id } });
  for (const url of new Set([...item.videoUrls, item.videoUrl])) await deleteVideoIfUnused(url);
  revalidatePath("/", "layout");
  redirect("/superadmin/portfolio");
}

export async function togglePortfolio(id: string, field: "published" | "featured") {
  await requireAdmin();
  const item = await db.portfolioItem.findUniqueOrThrow({ where: { id }, select: { published: true, featured: true } });
  await db.portfolioItem.update({ where: { id }, data: { [field]: !item[field] } });
  revalidatePath("/", "layout");
}

