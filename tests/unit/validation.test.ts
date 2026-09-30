import { describe, expect, it } from "vitest";
import { reviewSchema, serviceSchema, sessionSchema, testimonialSchema } from "@/lib/validation";

describe("review form validation", () => {
  const base = { name: "Ali Hassan", rating: "5", text: "Amazing drone clips of my waves at Machines!" };

  it("accepts a review with stars and a note", () => {
    const r = reviewSchema.parse({ ...base, instagram: "@ali.surf" });
    expect(r.rating).toBe(5);
    expect(r.instagram).toBe("ali.surf");
  });

  it("requires 1–5 stars", () => {
    expect(reviewSchema.safeParse({ ...base, rating: "" }).success).toBe(false);
    expect(reviewSchema.safeParse({ ...base, rating: "0" }).success).toBe(false);
    expect(reviewSchema.safeParse({ ...base, rating: "6" }).success).toBe(false);
    expect(reviewSchema.safeParse({ ...base, rating: "4.5" }).success).toBe(false);
    const { rating: _r, ...noRating } = base;
    expect(reviewSchema.safeParse(noRating).success).toBe(false);
  });

  it("requires a name and a real note, with sane limits", () => {
    expect(reviewSchema.safeParse({ ...base, name: "" }).success).toBe(false);
    expect(reviewSchema.safeParse({ ...base, text: "ok" }).success).toBe(false);
    expect(reviewSchema.safeParse({ ...base, text: "x".repeat(1501) }).success).toBe(false);
    expect(reviewSchema.safeParse({ ...base, instagram: "not a handle!" }).success).toBe(false);
  });

  it("admin reviews allow optional stars", () => {
    expect(testimonialSchema.parse({ name: "Sam", text: "Great session", rating: "" }).rating).toBeUndefined();
    expect(testimonialSchema.parse({ name: "Sam", text: "Great session", rating: "4" }).rating).toBe(4);
    expect(testimonialSchema.safeParse({ name: "Sam", text: "Great session", rating: "9" }).success).toBe(false);
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
