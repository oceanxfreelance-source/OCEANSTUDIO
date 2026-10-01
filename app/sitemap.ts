import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { siteUrl } from "@/lib/site";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [services, work, locations] = await Promise.all([
    db.service.findMany({ where: { published: true, status: { not: "HIDDEN" } }, select: { slug: true, updatedAt: true } }),
    db.portfolioItem.findMany({ where: { published: true }, select: { slug: true, updatedAt: true } }),
    db.location.findMany({ where: { published: true }, select: { slug: true, updatedAt: true } }),
  ]);
  const pages = ["", "/work", "/services", "/machines", "/about", "/contact", "/reviews"].map((p) => ({
    url: `${base}${p}`,
    changeFrequency: "weekly" as const,
    priority: p === "" ? 1 : 0.8,
  }));
  return [
    ...pages,
    ...services.map((s) => ({ url: `${base}/services/${s.slug}`, lastModified: s.updatedAt, priority: 0.7 })),
    ...work.map((w) => ({ url: `${base}/work/${w.slug}`, lastModified: w.updatedAt, priority: 0.6 })),
    ...locations.map((l) => ({ url: `${base}/machines/${l.slug}`, lastModified: l.updatedAt, priority: 0.6 })),
  ];
}
