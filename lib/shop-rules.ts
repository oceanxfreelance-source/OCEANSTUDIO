/**
 * Clip pricing, shared by the browser cart and the server (which always
 * recalculates — the browser's total is never trusted).
 *
 *  - Clips are priced per clip, grouped by session (date + time of day + spot).
 *  - A session never costs more than the full-session price: once
 *    clips × clip price passes it, the session price applies automatically.
 *  - The surfer can upgrade a session to "Full session" or "Session + reel".
 */
export type PriceList = { clip: number; session: number; reel: number };
export type SessionPackage = "CLIPS" | "SESSION" | "SESSION_REEL";
export type CartClip = { id: string; code: string; date: string; slot: string; spot: string; spotName: string; poster: string | null };

export function sessionKey(c: Pick<CartClip, "date" | "slot" | "spot">): string {
  return `${c.date}|${c.slot}|${c.spot}`;
}

export function sessionPrice(prices: PriceList, clipCount: number, pkg: SessionPackage): number {
  if (pkg === "SESSION_REEL") return prices.reel;
  if (pkg === "SESSION") return prices.session;
  return Math.min(clipCount * prices.clip, prices.session);
}

/** True when the per-clip total has been capped to the session price. */
export function isCapped(prices: PriceList, clipCount: number): boolean {
  return clipCount * prices.clip >= prices.session;
}

export function cartTotal(prices: PriceList, clips: CartClip[], packages: Record<string, SessionPackage>) {
  const groups = new Map<string, CartClip[]>();
  for (const c of clips) groups.set(sessionKey(c), [...(groups.get(sessionKey(c)) ?? []), c]);
  const sessions = [...groups.entries()].map(([key, items]) => {
    const chosen = packages[key] ?? "CLIPS";
    // Once the clips cost as much as the full session, it simply becomes the full session.
    const capped = chosen === "CLIPS" && isCapped(prices, items.length);
    const pkg: SessionPackage = capped ? "SESSION" : chosen;
    return { key, items, pkg, price: sessionPrice(prices, items.length, pkg), capped };
  });
  return { sessions, total: sessions.reduce((s, g) => s + g.price, 0) };
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

export type PayMethod = "BANK_TRANSFER" | "GUIDE" | "CASH";
export const PAYMENT_LABEL: Record<PayMethod | "PAYPAL" | "CARD", string> = {
  BANK_TRANSFER: "USD bank transfer",
  GUIDE: "Pay through my guide",
  CASH: "Cash to Ocean X",
  PAYPAL: "PayPal",
  CARD: "Card",
};
