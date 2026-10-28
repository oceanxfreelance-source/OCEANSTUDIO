"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import { firstBookableDay, hasRoom } from "@/lib/availability";
import { dayString, parseDay } from "@/lib/clips";
import { nextReference } from "@/lib/counters";
import { findOrCreateCustomer } from "@/lib/customers";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { bookingPackagePrice, getShopConfig, paymentMethods } from "@/lib/shop";
import { SLOT_LABEL } from "@/lib/shop-rules";
import { privateToken } from "@/lib/tokens";

const input = z.object({
  date: z.string(),
  slot: z.enum(["MORNING", "MIDDAY", "AFTERNOON"]),
  package: z.enum(["SESSION", "SESSION_REEL", "DRONE_CAMERA"]),
  surfers: z.coerce.number().int().min(1).max(10),
  recognition: z.string().trim().min(3, "Tell us how to recognise you in the water").max(500),
  name: z.string().trim().min(2, "Please enter your name").max(100),
  whatsapp: z.string().trim().max(30).optional().default(""),
  email: z.string().trim().max(200).optional().default(""),
  method: z.enum(["CASH", "BANK_TRANSFER"]),
  note: z.string().trim().max(1000).optional().default(""),
  website: z.string().optional(),
});

export type BookResult = { token: string } | { error: string; fieldErrors?: Record<string, string> };

/** A surfer books us to film a session. Price and deposit are worked out here, not in the browser. */
export async function createBooking(raw: z.input<typeof input>): Promise<BookResult> {
  const p = input.safeParse(raw);
  if (!p.success) {
    const fe: Record<string, string> = {};
    for (const i of p.error.issues) fe[String(i.path[0])] ??= i.message;
    return { error: "Please check the highlighted fields.", fieldErrors: fe };
  }
  const v = p.data;
  if (v.website) return { error: "Something went wrong. Please try again." };
  const date = parseDay(v.date);
  if (!date || v.date < firstBookableDay()) return { error: "Please choose a date.", fieldErrors: { date: "Choose a day from tomorrow on" } };
  const whatsapp = v.whatsapp.replace(/[^\d+ ]/g, "").trim();
  const email = v.email.toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Please check the highlighted fields.", fieldErrors: { email: "Enter a valid email" } };
  if (whatsapp.replace(/\D/g, "").length < 6 && !email) return { error: "Please check the highlighted fields.", fieldErrors: { whatsapp: "Add your WhatsApp number or email so we can reach you" } };

  const cfg = await getShopConfig();
  const each = bookingPackagePrice(cfg, v.package);
  if (each === null) return { error: "That package isn't available. Please choose another." };
  if (!paymentMethods(cfg).includes(v.method)) return { error: "Please choose how you'll pay the deposit." };
  const maxDay = dayString(new Date(Date.now() + cfg.bookAheadDays * 86400_000));
  if (v.date > maxDay) return { error: "That date is too far ahead — message us on WhatsApp." };

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  if (!(await rateLimit(`booking:${ip}`, 5, 3600))) return { error: "Too many bookings from this connection. Please message us on WhatsApp." };

  if (!(await hasRoom(cfg, v.date, v.slot))) return { error: `The ${SLOT_LABEL[v.slot].toLowerCase()} session on that day just filled up. Please pick another.`, fieldErrors: { date: "Full" } };

  // Ocean X only works at Machines.
  const spot = await db.location.findUnique({ where: { slug: "machines" }, select: { id: true, name: true } });
  const price = each * v.surfers;
  const deposit = Math.round(price * cfg.depositPercent) / 100;
  const ref = (await cookies()).get("ox_ref")?.value;
  const token = privateToken();

  await db.$transaction(async (tx) => {
    const customer = await findOrCreateCustomer(tx, { name: v.name, whatsapp: whatsapp || null, email: email || null });
    const reference = await nextReference(tx, "booking", "OX-B");
    await tx.booking.create({
      data: {
        reference,
        token,
        customerId: customer.id,
        fullName: v.name,
        whatsapp: whatsapp || null,
        email: email || null,
        preferredDate: date,
        slot: v.slot,
        locationId: spot?.id ?? null,
        locationText: spot?.name ?? "Machines",
        package: v.package,
        serviceName: cfg.packages[v.package].name, // name as it was when booked
        people: v.surfers,
        recognition: v.recognition,
        message: v.note,
        price,
        deposit,
        paymentMethod: v.method,
        partnerRef: ref && /^[a-z0-9-]{2,40}$/.test(ref) ? ref : null,
      },
    });
  });
  revalidatePath("/book");
  revalidatePath("/superadmin", "layout");
  return { token };
}
