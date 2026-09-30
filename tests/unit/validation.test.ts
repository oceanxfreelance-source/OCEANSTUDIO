import { describe, expect, it } from "vitest";
import { bookingRequestSchema, serviceSchema, sessionSchema } from "@/lib/validation";

describe("booking form validation", () => {
  const base = { fullName: "Ali Hassan" };

  it("needs a name and at least one way to reply", () => {
    expect(bookingRequestSchema.safeParse({ fullName: "" }).success).toBe(false);
    const noContact = bookingRequestSchema.safeParse(base);
    expect(noContact.success).toBe(false);
    expect(noContact.error?.issues[0]?.message).toMatch(/at least one way/);
    expect(bookingRequestSchema.safeParse({ ...base, instagram: "@ali.surf" }).success).toBe(true);
  });

  it("normalises Instagram handles and emails", () => {
    const r = bookingRequestSchema.parse({ ...base, instagram: "https://instagram.com/Ali.Surf/", email: " Ali@Example.COM " });
    expect(r.instagram).toBe("Ali.Surf");
    expect(r.email).toBe("ali@example.com");
  });

  it("rejects bad input", () => {
    expect(bookingRequestSchema.safeParse({ ...base, email: "not-an-email" }).success).toBe(false);
    expect(bookingRequestSchema.safeParse({ ...base, whatsapp: "call me" }).success).toBe(false);
    expect(bookingRequestSchema.safeParse({ ...base, email: "a@b.co", people: "2.5" }).success).toBe(false);
    expect(bookingRequestSchema.safeParse({ ...base, email: "a@b.co", preferredDate: "2020-01-01" }).success).toBe(false);
    expect(bookingRequestSchema.safeParse({ ...base, email: "a@b.co", message: "x".repeat(3001) }).success).toBe(false);
  });

  it("accepts a complete request", () => {
    const d = new Date(Date.now() + 5 * 86400_000).toISOString().slice(0, 10);
    const r = bookingRequestSchema.parse({ ...base, whatsapp: "+960 777-1234", preferredDate: d, people: "3", message: "Hi" });
    expect(r.people).toBe(3);
    expect(r.preferredDate?.toISOString().slice(0, 10)).toBe(d);
  });
});

describe("admin validation", () => {
  it("service price and status", () => {
    const ok = serviceSchema.parse({ name: "Drone Videography", shortDescription: "", description: "", status: "ACTIVE", priceType: "FROM", price: "$1,250.50", currency: "usd" });
    expect(ok.price).toBe("1250.50");
    expect(ok.currency).toBe("USD");
    expect(serviceSchema.safeParse({ name: "X y", shortDescription: "", description: "", status: "LIVE", priceType: "FROM" }).success).toBe(false);
    expect(serviceSchema.safeParse({ name: "X y", shortDescription: "", description: "", status: "ACTIVE", priceType: "FROM", price: "-5" }).success).toBe(false);
  });

  it("session requires customer and date; delivery link must be a URL", () => {
    const base = { customerId: "c1", locationText: "", date: "2026-10-01", paymentStatus: "UNPAID", status: "SCHEDULED", deliveryStatus: "NOT_READY", notes: "" };
    expect(sessionSchema.safeParse(base).success).toBe(true);
    expect(sessionSchema.safeParse({ ...base, customerId: "" }).success).toBe(false);
    expect(sessionSchema.safeParse({ ...base, date: "" }).success).toBe(false);
    expect(sessionSchema.safeParse({ ...base, deliveryLink: "javascript:alert(1)" }).success).toBe(false);
    expect(sessionSchema.safeParse({ ...base, deliveryLink: "https://drive.google.com/x" }).success).toBe(true);
  });
});
