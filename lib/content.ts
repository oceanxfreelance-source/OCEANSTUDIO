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
  { group: "Home — hero", key: "hero.subtitle", label: "Hero subtitle", default: "Ocean & visual media from Laamu, Maldives." },
  { group: "Home — hero", key: "hero.location", label: "Location line", default: "LAAMU • MALDIVES" },
  { group: "Home — hero", key: "hero.primaryCta", label: "Main button", default: "BOOK A SESSION" },
  { group: "Home — hero", key: "hero.secondaryCta", label: "Second button", default: "EXPLORE OUR WORK" },
  { group: "Home — hero", key: "hero.imageId", label: "Hero image", default: "", type: "image", help: "A wide, cinematic photo. Shown on all devices." },
  {
    group: "Home — hero",
    key: "hero.videoUrl",
    label: "Hero background video (MP4 link)",
    default: "",
    type: "url",
    help: "Optional. A short, muted, compressed .mp4 (under ~8 MB). Only plays on larger screens — phones get the hero image.",
  },
  // Home — sections
  { group: "Home — sections", key: "home.introTitle", label: "Intro title", default: "Ocean, people and places — told visually." },
  {
    group: "Home — sections",
    key: "home.introBody",
    label: "Intro text",
    type: "textarea",
    default:
      "Ocean X is a visual-media company from Laamu. We film and photograph the ocean, the surf and the islands around us — for surfers, travellers, resorts and brands.",
  },
  { group: "Home — sections", key: "cta.title", label: "Call-to-action title", default: "Your session, from the water and the air." },
  {
    group: "Home — sections",
    key: "cta.body",
    label: "Call-to-action text",
    type: "textarea",
    default: "Tell us what you have in mind and when you're in Laamu. We'll reply personally.",
  },
  // About
  { group: "About", key: "about.title", label: "About title", default: "Born above the waves of Laamu." },
  {
    group: "About",
    key: "about.body",
    label: "About text",
    type: "textarea",
    help: "Separate paragraphs with a blank line.",
    default:
      "Ocean X started with a drone above the waves of Machines, Laamu. What began with surf has grown into a vision to capture the ocean, people and places that make Laamu unique.\n\nToday we create aerial films, surf content and visual stories for the people who ride these waves and the places that welcome them — and we're growing into sea, water and underwater photography, films and commercial production.",
  },
  { group: "About", key: "about.imageId", label: "About image", default: "", type: "image" },
  // Pages
  { group: "Page intros", key: "services.intro", label: "Services intro", type: "textarea", default: "What we create — from the air, on the water and on the islands." },
  { group: "Page intros", key: "work.intro", label: "Our work intro", type: "textarea", default: "Selected films and photographs from Laamu and beyond." },
  {
    group: "Page intros",
    key: "laamu.intro",
    label: "Laamu intro",
    type: "textarea",
    default: "Laamu is our home atoll — surf breaks, quiet islands, lagoons and the people who live by the sea.",
  },
  // Booking
  { group: "Booking", key: "booking.intro", label: "Booking page intro", type: "textarea", default: "Tell us about your session. No account needed — we'll get back to you personally." },
  { group: "Booking", key: "booking.success", label: "Confirmation message", type: "textarea", default: "Thanks for reaching out to Ocean X. We'll get back to you shortly." },
  // Contact & social
  { group: "Contact & social", key: "contact.text", label: "Contact text", type: "textarea", default: "For sessions, collaborations and commercial projects, message us any time." },
  { group: "Contact & social", key: "contact.email", label: "Email", default: "", help: "Leave empty to hide." },
  { group: "Contact & social", key: "contact.whatsapp", label: "WhatsApp number", default: "", help: "With country code, e.g. +960 7XX XXXX. Leave empty to hide." },
  { group: "Contact & social", key: "social.instagram", label: "Instagram username", default: "", help: "Without @, e.g. oceanx.maldives. Leave empty to hide." },
  { group: "Contact & social", key: "social.youtube", label: "YouTube link", default: "", type: "url" },
  { group: "Contact & social", key: "social.tiktok", label: "TikTok link", default: "", type: "url" },
  { group: "Contact & social", key: "social.facebook", label: "Facebook link", default: "", type: "url" },
  // Footer & SEO
  { group: "Footer & SEO", key: "footer.text", label: "Footer text", default: "Ocean & visual media from Laamu, Maldives." },
  {
    group: "Footer & SEO",
    key: "seo.description",
    label: "Search engine description",
    type: "textarea",
    default: "Ocean X is an ocean and visual-media company in Laamu, Maldives — drone videography, surf films and ocean photography around Machines and the Laamu atoll.",
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
