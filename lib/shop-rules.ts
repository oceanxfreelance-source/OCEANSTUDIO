/**
 * Clip pricing, shared by the browser cart and the server (which always
 * recalculates — the browser's total is never trusted).
 *
 * Simple: every clip the surfer picks costs the clip price, so the total is
 * clips × clip price. Clips are only grouped by session to show them tidily.
 * (SESSION / SESSION_REEL are kept for older orders.)
 */
export type PriceList = { clip: number; session: number; reel: number };
export type SessionPackage = "CLIPS" | "SESSION" | "SESSION_REEL";
export type CartClip = { id: string; code: string; date: string; slot: string; spot: string; spotName: string; poster: string | null };

export function sessionKey(c: Pick<CartClip, "date" | "slot" | "spot">): string {
  return `${c.date}|${c.slot}|${c.spot}`;
}

export function clipsPrice(prices: PriceList, clipCount: number): number {
  return Math.round(clipCount * prices.clip * 100) / 100;
}

export function cartTotal(prices: PriceList, clips: CartClip[]) {
  const groups = new Map<string, CartClip[]>();
  for (const c of clips) groups.set(sessionKey(c), [...(groups.get(sessionKey(c)) ?? []), c]);
  const sessions = [...groups.entries()].map(([key, items]) => ({ key, items, price: clipsPrice(prices, items.length) }));
  return { sessions, total: clipsPrice(prices, clips.length) };
}

export type Slot = "MORNING" | "MIDDAY" | "AFTERNOON";
export const SLOTS: Slot[] = ["MORNING", "MIDDAY", "AFTERNOON"];
export const SLOT_LABEL: Record<Slot, string> = { MORNING: "Morning", MIDDAY: "Midday", AFTERNOON: "Afternoon" };

export const ORDER_PACKAGE_LABEL: Record<SessionPackage, string> = {
  CLIPS: "Selected clips",
  SESSION: "Full session",
  SESSION_REEL: "Session + edited reel",
};

export const BOOKING_PACKAGE_LABEL: Record<"SESSION" | "SESSION_REEL" | "DRONE_CAMERA", string> = {
  SESSION: "Full session",
  SESSION_REEL: "Session + edited reel",
  DRONE_CAMERA: "Drone + camera",
};

export type PayMethod = "BANK_TRANSFER" | "CASH";
// GUIDE: older orders only (now part of bank transfer).
export const PAYMENT_LABEL: Record<PayMethod | "GUIDE" | "PAYPAL" | "CARD", string> = {
  BANK_TRANSFER: "Bank transfer (you or your guide)",
  GUIDE: "Bank transfer via guide",
  CASH: "Cash to Ocean X",
  PAYPAL: "PayPal",
  CARD: "Card",
};
