"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkbox, fieldErrors, formToObject, idList, type FormState } from "@/lib/forms";
import { uniqueSlug } from "@/lib/slug";
import { formatDate } from "@/lib/format";
import { deleteVideoIfUnused, isOurVideo } from "@/lib/video-storage";
import { portfolioSchema } from "@/lib/validation";

export async function savePortfolioItem(id: string | null, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = portfolioSchema.safeParse(formToObject(fd));
  if (!parsed.success) return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error.issues) };
  const v = parsed.data;
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
    videoUrl: v.videoUrl ?? null,
    displayOrder: v.displayOrder ?? 0,
    featured: checkbox(fd, "featured"),
    published: checkbox(fd, "published"),
    coverId: coverId ?? null,
  };

  let savedId = id;
  if (id) {
    const before = await db.portfolioItem.findUnique({ where: { id }, select: { videoUrl: true } });
    await db.$transaction([
      db.portfolioItem.update({ where: { id }, data }),
      db.portfolioImage.deleteMany({ where: { itemId: id } }),
      db.portfolioImage.createMany({ data: imageIds.map((mediaId, position) => ({ itemId: id, mediaId, position })) }),
    ]);
    await deleteVideoIfUnused(before?.videoUrl, data.videoUrl);
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
  await deleteVideoIfUnused(item.videoUrl);
  revalidatePath("/", "layout");
  redirect("/superadmin/portfolio");
}

export async function togglePortfolio(id: string, field: "published" | "featured") {
  await requireAdmin();
  const item = await db.portfolioItem.findUniqueOrThrow({ where: { id }, select: { published: true, featured: true } });
  await db.portfolioItem.update({ where: { id }, data: { [field]: !item[field] } });
  revalidatePath("/", "layout");
}

/**
 * "Add many videos": one published Surf portfolio item per uploaded clip, at
 * Machines when that location exists, shown on the given service's page
 * (Drone Videography by default). Title and details can be edited later.
 */
export async function createVideoItem(videoUrl: string, takenAt: number | null, serviceId?: string): Promise<{ id: string; title: string }> {
  await requireAdmin();
  if (!isOurVideo(videoUrl)) throw new Error("Only uploaded videos can be added here.");
  const date = takenAt && Number.isFinite(takenAt) && takenAt > 0 && takenAt <= Date.now() + 86_400_000 ? new Date(takenAt) : null;
  const title = `Surf session${date ? ` · ${formatDate(date, { day: "numeric", month: "short", year: "numeric", timeZone: "Indian/Maldives" })}` : ""}`;
  const machines = await db.location.findFirst({ where: { slug: "machines" }, select: { id: true } });
  const service = await db.service.findFirst({ where: serviceId ? { id: serviceId } : { slug: "drone-videography" }, select: { id: true } });
  const slug = await uniqueSlug(title, async (s) => !!(await db.portfolioItem.findUnique({ where: { slug: s } })));
  const item = await db.portfolioItem.create({
    data: { slug, title, category: "Surf", videoUrl, date, locationId: machines?.id ?? null, serviceId: service?.id ?? null, published: true },
  });
  revalidatePath("/", "layout");
  return { id: item.id, title };
}
