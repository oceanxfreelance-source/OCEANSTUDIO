import { cache } from "react";
import type { BookingPackage, DaySlot } from "@prisma/client";
import { getContent, type Content } from "./content";

/**
 * Clip-shop rules and prices, read from Website content (so the owner can
 * change them) with safe fallbacks. Pure helpers live in shop-rules.ts so the
 * browser cart can use the same pricing.
 */
import type { PayMethod } from "./shop-rules";
export { BOOKING_PACKAGE_LABEL, PAYMENT_LABEL, cartTotal, ORDER_PACKAGE_LABEL, sessionKey, sessionPrice, SLOT_LABEL, SLOTS, type CartClip, type PriceList } from "./shop-rules";

function num(v: string, fallback: number, min = 0, max = 100000): number {
  const n = Number(String(v).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && v.trim() !== "" && n >= min && n <= max ? n : fallback;
}

export type ShopConfig = ReturnType<typeof shopConfigFrom>;

export function shopConfigFrom(c: Content) {
  const drone = num(c["shop.priceDrone"], 0);
  return {
    prices: {
      clip: num(c["shop.priceClip"], 20, 1),
      session: num(c["shop.priceSession"], 60, 1),
      reel: num(c["shop.priceReel"], 100, 1),
    },
    dronePrice: drone > 0 ? drone : null,
    depositPercent: num(c["shop.depositPercent"], 50, 0, 100),
    maxPerSlot: Math.round(num(c["shop.maxPerSlot"], 2, 0, 50)),
    bookAheadDays: Math.round(num(c["shop.bookAheadDays"], 60, 1, 365)),
    downloadDays: Math.round(num(c["shop.downloadDays"], 7, 1, 90)),
    keepHours: Math.round(num(c["shop.keepHours"], 24, 6, 24 * 90)),
    bankDetails: c["pay.bankDetails"].trim(),
    cashText: c["pay.cashText"].trim(),
    whatsapp: c["contact.whatsapp"].trim(),
    notice: c["shop.filmingNotice"].trim(),
    slotTimes: { MORNING: c["slot.morning"], MIDDAY: c["slot.midday"], AFTERNOON: c["slot.afternoon"] } as Record<DaySlot, string>,
  };
}

export const getShopConfig = cache(async () => shopConfigFrom(await getContent()));

/** Price per surfer of a booking package, or null when not offered. */
export function bookingPackagePrice(cfg: ShopConfig, p: BookingPackage): number | null {
  if (p === "SESSION") return cfg.prices.session;
  if (p === "SESSION_REEL") return cfg.prices.reel;
  return cfg.dronePrice;
}

/**
 * Ways to pay. Bank transfer (by the surfer or through their guide, who then
 * uploads the slip) needs the bank details filled in.
 */
export function paymentMethods(cfg: ShopConfig): PayMethod[] {
  return cfg.bankDetails ? ["BANK_TRANSFER", "CASH"] : ["CASH"];
}
