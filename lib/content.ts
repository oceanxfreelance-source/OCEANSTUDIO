import { cache } from "react";
import { db } from "./db";

/**
 * Editable website text. Every key has a default so the site looks complete
 * before anything is edited. The Superadmin "Website content" page is built
 * from this list — add an entry here and it appears there automatically.
 */
export interface ContentField {
  key: string;
  label: string;
  group: string;
  default: string;
  type?: "text" | "textarea" | "url" | "image";
  help?: string;
}

export const CONTENT_FIELDS = [
  // Home — hero
  { group: "Home — hero", key: "hero.title", label: "Hero title", default: "CAPTURED BY THE OCEAN." },
  { group: "Home — hero", key: "hero.subtitle", label: "Hero subtitle", default: "Surf films and surf photography at Machines, Maabaidhoo — Laamu, Maldives." },
  { group: "Home — hero", key: "hero.location", label: "Location line", default: "MACHINES • MAABAIDHOO • LAAMU" },
  { group: "Home — hero", key: "hero.primaryCta", label: "Main button", default: "EXPLORE OUR WORK" },
  { group: "Home — hero", key: "hero.secondaryCta", label: "Second button", default: "READ REVIEWS" },
  { group: "Home — hero", key: "hero.imageId", label: "Hero image", default: "", type: "image", help: "A wide, cinematic photo. Shown on all devices." },
  {
    group: "Home — hero",
    key: "hero.videoUrl",
    label: "Hero background video",
    default: "",
    type: "url",
    help: "Optional. A short silent drone clip. Only plays on larger screens — phones get the hero image.",
  },
  // Home — sections
  { group: "Home — sections", key: "home.introTitle", label: "Intro title", default: "You surf. We capture every wave." },
  {
    group: "Home — sections",
    key: "home.introBody",
    label: "Intro text",
    type: "textarea",
    default:
      "Ocean X films and photographs surfers at Machines, Maabaidhoo — from the drone above the line-up to the moments between sets. Take a look at our work, and see what surfers say about their sessions with us.",
  },
  { group: "Home — sections", key: "cta.title", label: "Call-to-action title", default: "Surfed Machines with us?" },
  {
    group: "Home — sections",
    key: "cta.body",
    label: "Call-to-action text",
    type: "textarea",
    default: "Tell other surfers how it went — leave a review with a few stars and a note.",
  },
  // About
  { group: "About", key: "about.title", label: "About title", default: "Born above the waves of Machines." },
  {
    group: "About",
    key: "about.body",
    label: "About text",
    type: "textarea",
    help: "Separate paragraphs with a blank line.",
    default:
      "Ocean X started with a drone above the waves of Machines, Maabaidhoo. We're surfers filming surfers — every session is about your waves, your style and the moments you want to remember.\n\nToday we film aerial surf sessions at Machines, and surf photography from the channel and in the water is coming soon.",
  },
  { group: "About", key: "about.imageId", label: "About image", default: "", type: "image" },
  // Pages
  { group: "Page intros", key: "services.intro", label: "Services intro", type: "textarea", default: "Surf sessions at Machines — filmed from the air, with photography from the channel and the water coming soon." },
  { group: "Page intros", key: "work.intro", label: "Our work intro", type: "textarea", default: "Surf films and photos from Machines, Maabaidhoo." },
  {
    group: "Page intros",
    key: "laamu.intro",
    label: "Machines & Maabaidhoo intro",
    type: "textarea",
    default: "Machines is the wave. Maabaidhoo is home. Every Ocean X surf session happens here, in Laamu Atoll.",
  },
  // Reviews
  { group: "Reviews", key: "reviews.intro", label: "Reviews page intro", type: "textarea", default: "What surfers say about their sessions with Ocean X at Machines." },
  {
    group: "Reviews",
    key: "reviews.thanks",
    label: "Message after sending a review",
    type: "textarea",
    default: "Thank you! Your review has been sent and will appear on the site once we've checked it.",
  },
  // Contact & social
  { group: "Contact & social", key: "contact.text", label: "Contact text", type: "textarea", default: "Questions about our surf filming, or want to work together? Message us any time." },
  { group: "Contact & social", key: "contact.email", label: "Email", default: "", help: "Leave empty to hide." },
  { group: "Contact & social", key: "contact.whatsapp", label: "WhatsApp number", default: "", help: "With country code, e.g. +960 7XX XXXX. Leave empty to hide." },
  { group: "Contact & social", key: "social.instagram", label: "Instagram username", default: "", help: "Without @, e.g. oceanx.maldives. Leave empty to hide." },
  { group: "Contact & social", key: "social.youtube", label: "YouTube link", default: "", type: "url" },
  { group: "Contact & social", key: "social.tiktok", label: "TikTok link", default: "", type: "url" },
  { group: "Contact & social", key: "social.facebook", label: "Facebook link", default: "", type: "url" },
  // Footer & SEO
  { group: "Footer & SEO", key: "footer.text", label: "Footer text", default: "Surf films & photography at Machines, Maabaidhoo — Laamu, Maldives." },
  {
    group: "Footer & SEO",
    key: "seo.description",
    label: "Search engine description",
    type: "textarea",
    default: "Ocean X — surf films, drone surf videography and surf photography at Machines, Maabaidhoo, in Laamu Atoll, Maldives.",
  },
] as const satisfies readonly ContentField[];

export type ContentKey = (typeof CONTENT_FIELDS)[number]["key"];
export type Content = Record<ContentKey, string>;

const DEFAULTS = Object.fromEntries(CONTENT_FIELDS.map((f) => [f.key, f.default])) as Content;

/** All site text: saved values over defaults. Cached per request. */
export const getContent = cache(async (): Promise<Content> => {
  const rows = await db.setting.findMany({ where: { key: { in: CONTENT_FIELDS.map((f) => f.key) } } });
  const out = { ...DEFAULTS };
  for (const r of rows) out[r.key as ContentKey] = r.value;
  return out;
});

export function isContentKey(key: string): key is ContentKey {
  return key in DEFAULTS;
}
