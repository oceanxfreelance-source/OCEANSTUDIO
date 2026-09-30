/**
 * Booking requests against a real Postgres database (skipped without DATABASE_URL).
 */
import { afterAll, describe, expect, it } from "vitest";
import { createBookingRequest } from "@/lib/bookings";
import { db } from "@/lib/db";

const run = Date.now().toString(36);
const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("createBookingRequest", () => {
  const created: string[] = [];
  afterAll(async () => {
    const bookings = await db.booking.findMany({ where: { id: { in: created } }, select: { customerId: true } });
    await db.booking.deleteMany({ where: { id: { in: created } } });
    await db.customer.deleteMany({ where: { id: { in: bookings.map((b) => b.customerId) } } });
    await db.$disconnect();
  });

  it("creates a customer and a NEW booking with a friendly reference", async () => {
    const b = await createBookingRequest({ fullName: `Unit ${run}`, instagram: `unit_${run}`, people: 2, message: "hi" });
    created.push(b.id);
    expect(b.status).toBe("NEW");
    expect(b.reference).toMatch(/^OX-B-\d{5}$/);
    const c = await db.customer.findUniqueOrThrow({ where: { id: b.customerId } });
    expect(c.instagram).toBe(`unit_${run}`);
  });

  it("matches a returning customer by Instagram (any case) or WhatsApp digits", async () => {
    const first = await createBookingRequest({ fullName: `Unit ${run}`, instagram: `unit_${run}`, whatsapp: "+960 700 0001" });
    const again = await createBookingRequest({ fullName: "Different spelling", instagram: `UNIT_${run}` });
    const byPhone = await createBookingRequest({ fullName: "Phone only", whatsapp: "9607000001" });
    created.push(first.id, again.id, byPhone.id);
    expect(again.customerId).toBe(first.customerId);
    expect(byPhone.customerId).toBe(first.customerId);
    // an earlier-missing detail is filled in, never overwritten
    const c = await db.customer.findUniqueOrThrow({ where: { id: first.customerId } });
    expect(c.whatsapp).toBe("+960 700 0001");
    expect(c.name).toBe(`Unit ${run}`);
  });

  it("ignores hidden services", async () => {
    const hidden = await db.service.create({ data: { slug: `hidden-${run}`, name: "Hidden", status: "HIDDEN" } });
    const b = await createBookingRequest({ fullName: `Unit ${run}`, email: `u${run}@example.com`, serviceId: hidden.id });
    created.push(b.id);
    expect(b.serviceId).toBeNull();
    await db.service.delete({ where: { id: hidden.id } });
  });
});
