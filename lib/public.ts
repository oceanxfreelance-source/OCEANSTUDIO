import "server-only";
import { cache } from "react";
import { db } from "./db";
import { posterFor } from "./video";

/**
 * Read-only queries for the PUBLIC website. Everything here filters to
 * published content only — drafts, hidden services and all business data
 * (customers, sessions) are never selected.
 */

const media = { select: { id: true, width: true, height: true, alt: true } } as const;

export const getPublicServices = cache(() =>
  db.service.findMany({
    where: { published: true, status: { not: "HIDDEN" } },
    orderBy: [{ status: "asc" }, { displayOrder: "asc" }, { createdAt: "asc" }],
    include: { cover: media },
  }),
);

export const getPublicService = cache((slug: string) =>
  db.service.findFirst({
    where: { slug, published: true, status: { not: "HIDDEN" } },
    include: {
      cover: media,
      images: { orderBy: { position: "asc" }, include: { media } },
      films: {
        where: { published: true, videoUrl: { not: null } },
        orderBy: [{ featured: "desc" }, { displayOrder: "asc" }, { date: "desc" }, { createdAt: "desc" }],
        select: { id: true, slug: true, title: true, videoUrl: true, date: true },
      },
    },
  }),
);

export const getPortfolio = cache((category?: string) =>
  db.portfolioItem.findMany({
    where: { published: true, ...(category ? { category } : {}) },
    orderBy: [{ featured: "desc" }, { displayOrder: "asc" }, { date: "desc" }, { createdAt: "desc" }],
    include: { cover: media, location: { select: { name: true, slug: true, published: true } } },
  }),
);

export const getPortfolioItem = cache((slug: string) =>
  db.portfolioItem.findFirst({
    where: { slug, published: true },
    include: {
      cover: media,
      images: { orderBy: { position: "asc" }, include: { media } },
      location: { select: { name: true, slug: true, published: true } },
    },
  }),
);

export const getFeaturedWork = cache((take = 6) =>
  db.portfolioItem.findMany({
    where: { published: true },
    orderBy: [{ featured: "desc" }, { displayOrder: "asc" }, { date: "desc" }, { createdAt: "desc" }],
    take,
    include: { cover: media, location: { select: { name: true } } },
  }),
);

export const getLocations = cache(() =>
  db.location.findMany({
    where: { published: true },
    orderBy: [{ featured: "desc" }, { displayOrder: "asc" }, { name: "asc" }],
    include: { cover: media },
  }),
);

export const getLocation = cache((slug: string) =>
  db.location.findFirst({
    where: { slug, published: true },
    include: {
      cover: media,
      images: { orderBy: { position: "asc" }, include: { media } },
      portfolio: { where: { published: true }, orderBy: { date: "desc" }, include: { cover: media } },
    },
  }),
);

/** Average star rating and number of published reviews. */
export const getReviewStats = cache(async () => {
  const agg = await db.testimonial.aggregate({ where: { published: true }, _count: true, _avg: { rating: true } });
  const rated = await db.testimonial.count({ where: { published: true, rating: { not: null } } });
  return { count: agg._count, rated, average: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : null };
});

export const getTestimonials = cache((onlyFeatured = false) =>
  db.testimonial.findMany({
    where: { published: true, ...(onlyFeatured ? { featured: true } : {}) },
    orderBy: [{ featured: "desc" }, { date: "desc" }, { createdAt: "desc" }],
    take: onlyFeatured ? 6 : 100,
    include: { avatar: media },
  }),
);

export type MediaRef = { id: string; width: number; height: number; alt: string };

/**
 * Real footage used to dress the site when a photo hasn't been uploaded yet:
 * the cover frames (and clips) of optimised videos from published work and
 * locations — featured and newest first.
 */
export const getShowcase = cache(async () => {
  const [work, places] = await Promise.all([
    db.portfolioItem.findMany({
      where: { published: true, videoUrl: { contains: "/videos/web/" } },
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
      select: { title: true, slug: true, videoUrl: true },
    }),
    db.location.findMany({
      where: { published: true, videoUrl: { contains: "/videos/web/" } },
      orderBy: [{ featured: "desc" }, { displayOrder: "asc" }],
      select: { name: true, slug: true, videoUrl: true },
    }),
  ]);
  return [
    ...work.map((w) => ({ title: w.title, href: `/work/${w.slug}`, video: w.videoUrl! })),
    ...places.map((l) => ({ title: l.name, href: `/machines/${l.slug}`, video: l.videoUrl! })),
  ]
    .map((s) => ({ ...s, poster: posterFor(s.video) }))
    .filter((s): s is typeof s & { poster: string } => !!s.poster);
});
