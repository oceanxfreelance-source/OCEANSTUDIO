import { PRICE_TYPE_LABEL } from "./constants";

type Decimalish = { toString(): string } | number | string | null | undefined;

export function toNumber(v: Decimalish): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v.toString());
  return Number.isFinite(n) ? n : null;
}

export function money(v: Decimalish, currency = "USD"): string {
  const n = toNumber(v);
  if (n === null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: n % 1 === 0 ? 0 : 2 }).format(n);
}

/** Public price label, e.g. "From $150", "$80 per person", "Price on request". */
export function priceLabel(price: Decimalish, type: keyof typeof PRICE_TYPE_LABEL, currency = "USD"): string {
  const n = toNumber(price);
  if (type === "ON_REQUEST" || n === null) return "Price on request";
  const m = money(n, currency);
  switch (type) {
    case "FROM":
      return `From ${m}`;
    case "PER_PERSON":
      return `${m} per person`;
    case "PER_HOUR":
      return `${m} per hour`;
    case "PER_SESSION":
      return `${m} per session`;
    default:
      return m;
  }
}

export function formatDate(d: Date | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...opts }).format(d);
}

export function formatDateTime(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Indian/Maldives", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
}

/** yyyy-mm-dd for <input type="date"> */
export function dateInputValue(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

export function instagramUrl(handle: string | null | undefined): string | null {
  const h = handle?.trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/.*$/, "");
  return h ? `https://instagram.com/${encodeURIComponent(h)}` : null;
}

export function whatsappUrl(number: string | null | undefined, text?: string): string | null {
  const digits = number?.replace(/[^\d]/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
