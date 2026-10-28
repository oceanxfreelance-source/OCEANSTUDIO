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
  type?: "text" | "textarea" | "url" | "image" | "number";
  help?: string;
}

export const CONTENT_FIELDS = [
  // Home — hero
  { group: "Home — hero", key: "hero.title", label: "Hero title", default: "CAPTURED BY THE OCEAN." },
  { group: "Home — hero", key: "hero.subtitle", label: "Hero subtitle", default: "Surf films and surf photography at Machines, Maabaidhoo — Laamu, Maldives." },
  { group: "Home — hero", key: "hero.location", label: "Location line", default: "MACHINES • MAABAIDHOO • LAAMU" },
  { group: "Home — hero", key: "hero.primaryCta", label: "Main button (Find my clips)", default: "FIND MY CLIPS" },
  { group: "Home — hero", key: "hero.secondaryCta", label: "Second button (Book)", default: "BOOK A SESSION" },
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
    default: "Had a drone videography session with us? Tell other surfers how your clips turned out.",
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
  // Booking via Instagram DM
  { group: "Booking", key: "book.title", label: "Booking title", default: "Want us to film your session?" },
  {
    group: "Booking",
    key: "book.body",
    label: "Booking text",
    type: "textarea",
    default: "Pick a day and session, tell us how to spot you in the water, and we'll film every wave. Clips arrive on your private page the same day.",
  },
  // Reviews
  { group: "Reviews", key: "reviews.intro", label: "Reviews page intro", type: "textarea", default: "What surfers say about their drone videography sessions with Ocean X at Machines." },
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
  { group: "Contact & social", key: "social.instagram", label: "Instagram username", default: "", help: "Without @, e.g. oceanx.maldives. Guests book by DM — this turns on the “Book via Instagram” buttons. Leave empty to hide." },
  { group: "Contact & social", key: "social.youtube", label: "YouTube link", default: "", type: "url" },
  { group: "Contact & social", key: "social.tiktok", label: "TikTok link", default: "", type: "url" },
  { group: "Contact & social", key: "social.facebook", label: "Facebook link", default: "", type: "url" },
  // Clip shop — prices (USD)
  { group: "Clip shop — prices", key: "shop.priceClip", type: "number", label: "Price per clip (USD)", default: "20", help: "Every clip costs this. The guest pays for the clips they pick." },
  { group: "Clip shop — prices", key: "shop.priceSession", type: "number", label: "Booking package 1 — price (USD)", default: "60", help: "Only for bookings (Book a session), per surfer." },
  { group: "Clip shop — prices", key: "pkg.session.name", label: "Booking package 1 — name", default: "Full session" },
  { group: "Clip shop — prices", key: "pkg.session.desc", label: "Booking package 1 — description", default: "Every clip of you, delivered by private link" },
  { group: "Clip shop — prices", key: "shop.priceReel", type: "number", label: "Booking package 2 — price (USD)", default: "100", help: "Only for bookings, per surfer." },
  { group: "Clip shop — prices", key: "pkg.reel.name", label: "Booking package 2 — name", default: "Session + edited reel" },
  { group: "Clip shop — prices", key: "pkg.reel.desc", label: "Booking package 2 — description", default: "All clips + a 30–60 s edited reel with music" },
  { group: "Clip shop — prices", key: "shop.priceDrone", type: "number", label: "Booking package 3 — price (USD)", default: "", help: "For bookings. Leave empty to hide this package." },
  { group: "Clip shop — prices", key: "pkg.drone.name", label: "Booking package 3 — name", default: "Drone + camera" },
  { group: "Clip shop — prices", key: "pkg.drone.desc", label: "Booking package 3 — description", default: "Drone and camera angles of your session" },
  { group: "Clip shop — prices", key: "shop.depositPercent", type: "number", label: "Booking deposit (%)", default: "50" },
  // Clip shop — payment
  {
    group: "Clip shop — payment",
    key: "pay.bankDetails",
    label: "USD bank transfer details",
    type: "textarea",
    default: "",
    help: "Account name, bank and USD account number — one per line. Shown at checkout with a copy button. Leave empty to hide bank transfer.",
  },
  { group: "Clip shop — payment", key: "pay.cashText", label: "Cash payment note", type: "textarea", default: "Pay cash when we meet on the island — we'll arrange it on WhatsApp." },
  { group: "Clip shop — payment", key: "pay.paypalLink", label: "PayPal.me link", default: "", type: "url", help: "Not live yet. Leave empty." },
  // Clip shop — sessions & delivery
  { group: "Clip shop — sessions", key: "slot.morning", label: "Morning session time", default: "6:00 – 9:30" },
  { group: "Clip shop — sessions", key: "slot.midday", label: "Midday session time", default: "10:30 – 13:30" },
  { group: "Clip shop — sessions", key: "slot.afternoon", label: "Afternoon session time", default: "15:00 – 18:00" },
  { group: "Clip shop — sessions", key: "shop.maxPerSlot", type: "number", label: "Default bookings per session", default: "2", help: "Change single days under Bookings → Availability." },
  { group: "Clip shop — sessions", key: "shop.bookAheadDays", type: "number", label: "How far ahead surfers can book (days)", default: "60" },
  { group: "Clip shop — sessions", key: "shop.downloadDays", type: "number", label: "Download links valid for (days)", default: "7" },
  {
    group: "Clip shop — sessions",
    key: "shop.keepHours", type: "number",
    label: "Delete unsold clips after (hours)",
    default: "24",
    help: "Keeps storage small. Clips someone ordered or booked are kept until their downloads end. Cleanup runs every night.",
  },
  {
    group: "Clip shop — sessions",
    key: "shop.filmingNotice",
    label: "Filming & privacy notice",
    type: "textarea",
    default: "We film surfers at the break from the boat, the channel and (with a permit) the drone. Previews are small and watermarked; full clips go only to the person who buys them. Don't want to be in the gallery? Ask us to remove your clip — we do it fast.",
  },
  // Footer & SEO
  { group: "Footer & SEO", key: "footer.text", label: "Footer text", default: "Surf films & photography at Machines, Maabaidhoo — Laamu, Maldives." },
  {
    group: "Footer & SEO",
    key: "seo.description",
    label: "Search engine description",
    type: "textarea",
    default: "Ocean X — surf video and surf photography in the Maldives: we film every session at Machines, Maabaidhoo (Laamu). Find your surf clips the same day, or book a filmed session.",
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
