"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import type { DaySlot, OrderPackage } from "@prisma/client";
import { GALLERY } from "@/lib/clip-shop";
import { dayString } from "@/lib/clips";
import { nextReference } from "@/lib/counters";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { getShopConfig, paymentMethods } from "@/lib/shop";
import { isCapped, sessionKey, sessionPrice } from "@/lib/shop-rules";
import { privateToken } from "@/lib/tokens";

const input = z.object({
  clipIds: z.array(z.string().max(40)).min(1, "Your cart is empty").max(100),
  packages: z.record(z.string().max(80), z.enum(["CLIPS", "SESSION", "SESSION_REEL"])).default({}),
  name: z.string().trim().min(2, "Please enter your name").max(100),
  whatsapp: z.string().trim().max(30).optional().default(""),
  email: z.string().trim().max(200).optional().default(""),
  method: z.enum(["CASH", "BANK_TRANSFER", "GUIDE"]),
  guide: z.string().trim().max(100).optional().default(""),
  note: z.string().trim().max(1000).optional().default(""),
  website: z.string().optional(), // honeypot
});

export type PlaceOrderResult = { token: string } | { error: string; fieldErrors?: Record<string, string>; missing?: string[] };

/**
 * Create an order from the cart. Prices are recalculated here from the
 * database and the owner's price list — the browser's numbers are ignored.
 */
export async function placeOrder(raw: z.input<typeof input>): Promise<PlaceOrderResult> {
  const p = input.safeParse(raw);
  if (!p.success) {
    const fe: Record<string, string> = {};
    for (const i of p.error.issues) fe[String(i.path[0])] ??= i.message;
    return { error: "Please check the highlighted fields.", fieldErrors: fe };
  }
  const v = p.data;
  if (v.website) return { error: "Something went wrong. Please try again." };
  const whatsapp = v.whatsapp.replace(/[^\d+ ]/g, "").trim();
  const email = v.email.toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Please check the highlighted fields.", fieldErrors: { email: "Enter a valid email" } };
  if (whatsapp.replace(/\D/g, "").length < 6 && !email) return { error: "Please check the highlighted fields.", fieldErrors: { whatsapp: "Add your WhatsApp number or email so we can reach you" } };

  const cfg = await getShopConfig();
  if (!paymentMethods(cfg).includes(v.method)) return { error: "Please choose a payment method." };
  if (v.method === "GUIDE" && v.guide.length < 2) return { error: "Please check the highlighted fields.", fieldErrors: { guide: "Tell us your guide's name or guesthouse" } };

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  if (!(await rateLimit(`order:${ip}`, 10, 3600))) return { error: "Too many orders from this connection. Please message us on WhatsApp." };

  const ids = [...new Set(v.clipIds)];
  const clips = await db.clip.findMany({ where: { ...GALLERY, id: { in: ids } }, include: { location: { select: { id: true, code: true } } } });
  if (clips.length !== ids.length) {
    const found = new Set(clips.map((c) => c.id));
    return { error: "Some clips in your cart are no longer available. They've been removed — please check your cart again.", missing: ids.filter((id) => !found.has(id)) };
  }

  // Group by session (day + time of day + spot) and price each group.
  const groups = new Map<string, typeof clips>();
  for (const c of clips) {
    const key = sessionKey({ date: dayString(c.date), slot: c.slot, spot: c.location?.code ?? "OX" });
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  const sessions = [...groups.entries()].map(([key, items]) => {
    const chosen = (v.packages[key] ?? "CLIPS") as OrderPackage;
    const pkg: OrderPackage = chosen === "CLIPS" && isCapped(cfg.prices, items.length) ? "SESSION" : chosen;
    return { items, pkg, price: sessionPrice(cfg.prices, items.length, pkg), date: items[0]!.date, slot: items[0]!.slot as DaySlot, locationId: items[0]!.location?.id ?? null };
  });
  const total = sessions.reduce((s, g) => s + g.price, 0);
  const ref = (await cookies()).get("ox_ref")?.value;

  const token = privateToken();
  await db.$transaction(async (tx) => {
    const reference = await nextReference(tx, "order", "OX-O");
    await tx.order.create({
      data: {
        reference,
        token,
        name: v.name,
        whatsapp: whatsapp || null,
        email: email || null,
        paymentMethod: v.method,
        total,
        note: v.method === "GUIDE" ? `Guide: ${v.guide}${v.note ? `\n${v.note}` : ""}` : v.note,
        partnerRef: ref && /^[a-z0-9-]{2,40}$/.test(ref) ? ref : null,
        sessions: {
          create: sessions.map((s) => ({
            date: s.date,
            slot: s.slot,
            locationId: s.locationId,
            package: s.pkg,
            price: s.price,
            items: { create: s.items.map((c) => ({ clipId: c.id, clipCode: c.code })) },
          })),
        },
      },
    });
  });
  revalidatePath("/superadmin", "layout");
  return { token };
}
