import { z } from "zod";
import { LOCATION_KINDS, PORTFOLIO_CATEGORIES } from "./constants";

// ── small building blocks ──────────────────────────────────────────────
const trimmed = (max: number) => z.string().trim().max(max, `Maximum ${max} characters`);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Maximum ${max} characters`)
    .optional()
    .transform((v) => (v ? v : undefined));

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => !v || /^https?:\/\/[^\s]+$/i.test(v), "Enter a full link starting with https://");

const optionalMoney = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v.replace(/[$,\s]/g, "") : undefined))
  .refine((v) => v === undefined || (/^\d{1,8}(\.\d{1,2})?$/.test(v) && Number(v) >= 0), "Enter an amount like 150 or 150.50");

const optionalInt = (max: number) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v) : undefined))
    .refine((v) => v === undefined || (Number.isInteger(v) && v >= 0 && v <= max), `Enter a whole number up to ${max}`);

const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => !v || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))), "Choose a valid date")
  .transform((v) => (v ? new Date(`${v}T00:00:00Z`) : undefined));

const instagramHandle = z
  .string()
  .trim()
  .max(60)
  .optional()
  .transform((v) => {
    if (!v) return undefined;
    const h = v.replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/[/?#].*$/, "");
    return h || undefined;
  })
  .refine((v) => !v || /^[A-Za-z0-9._]{1,30}$/.test(v), "Enter a valid Instagram username");

const optionalEmail = z
  .string()
  .trim()
  .max(200)
  .optional()
  .transform((v) => (v ? v.toLowerCase() : undefined))
  .refine((v) => !v || z.string().email().safeParse(v).success, "Enter a valid email address");

const optionalPhone = z
  .string()
  .trim()
  .max(40)
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => !v || /^\+?[\d\s()-]{6,25}$/.test(v), "Enter a valid phone number with country code");

// ── public review form ─────────────────────────────────────────────────
const stars = z
  .string()
  .trim()
  .regex(/^[1-5]$/, "Please choose 1 to 5 stars")
  .transform(Number);

export const reviewSchema = z.object({
  name: trimmed(80).min(2, "Please enter your name"),
  instagram: instagramHandle,
  rating: z.string({ required_error: "Please choose 1 to 5 stars" }).pipe(stars),
  text: trimmed(1500).min(10, "Please write a few words about your session (at least 10 characters)"),
});
export type ReviewInput = z.infer<typeof reviewSchema>;

// ── admin: content ───────────────────────────────────────────────────────
const status = z.enum(["ACTIVE", "COMING_SOON", "HIDDEN"]);
const priceType = z.enum(["ON_REQUEST", "FIXED", "FROM", "PER_PERSON", "PER_HOUR", "PER_SESSION"]);

export const serviceSchema = z.object({
  name: trimmed(100).min(2, "Name is required"),
  shortDescription: trimmed(300),
  description: trimmed(8000),
  status,
  price: optionalMoney,
  priceType,
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use a 3-letter currency code, e.g. USD").default("USD"),
  displayOrder: optionalInt(10000),
});

export const portfolioSchema = z.object({
  title: trimmed(140).min(2, "Title is required"),
  description: trimmed(8000),
  category: z.enum(PORTFOLIO_CATEGORIES),
  locationId: optionalText(40),
  serviceId: optionalText(40),
  date: optionalDate,
  videoUrl: optionalUrl,
  displayOrder: optionalInt(10000),
});

export const locationSchema = z.object({
  name: trimmed(100).min(2, "Name is required"),
  kind: z.enum(LOCATION_KINDS),
  atoll: trimmed(60).min(2).default("Laamu"),
  description: trimmed(8000),
  videoUrl: optionalUrl,
  displayOrder: optionalInt(10000),
});

export const testimonialSchema = z.object({
  name: trimmed(100).min(2, "Name is required"),
  instagram: instagramHandle,
  text: trimmed(2000).min(5, "Review text is required"),
  rating: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v) : undefined))
    .refine((v) => v === undefined || (Number.isInteger(v) && v >= 1 && v <= 5), "Choose 1 to 5 stars"),
  date: optionalDate,
});

// ── admin: business ──────────────────────────────────────────────────────
export const customerSchema = z.object({
  name: trimmed(120).min(2, "Name is required"),
  instagram: instagramHandle,
  email: optionalEmail,
  whatsapp: optionalPhone,
  country: optionalText(80),
  notes: trimmed(5000),
});

export const sessionSchema = z.object({
  customerId: z.string().trim().min(1, "Choose a customer"),
  serviceId: optionalText(40),
  locationText: trimmed(120),
  date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date")
    .transform((v) => new Date(`${v}T00:00:00Z`)),
  time: optionalText(40),
  people: optionalInt(100),
  clips: optionalInt(10000),
  price: optionalMoney,
  paymentStatus: z.enum(["UNPAID", "DEPOSIT", "PAID", "REFUNDED"]),
  status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED"]),
  deliveryStatus: z.enum(["NOT_READY", "PROCESSING", "READY", "SENT"]),
  deliveryLink: optionalUrl,
  notes: trimmed(5000),
});
