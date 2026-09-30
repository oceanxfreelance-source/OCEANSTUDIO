import { describe, expect, it } from "vitest";
import { instagramDmUrl, instagramUrl, priceLabel, whatsappUrl } from "@/lib/format";
import { hashPassword, verifyPassword } from "@/lib/password";
import { slugify, uniqueSlug } from "@/lib/slug";
import { parseVideoUrl } from "@/lib/video";

describe("video links", () => {
  it("recognises YouTube, Vimeo, files and other links", () => {
    expect(parseVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toMatchObject({ kind: "youtube", id: "dQw4w9WgXcQ" });
    expect(parseVideoUrl("https://youtu.be/dQw4w9WgXcQ?t=3")).toMatchObject({ kind: "youtube", id: "dQw4w9WgXcQ" });
    expect(parseVideoUrl("https://youtube.com/shorts/dQw4w9WgXcQ")).toMatchObject({ kind: "youtube" });
    expect(parseVideoUrl("https://vimeo.com/123456789")).toMatchObject({ kind: "vimeo", id: "123456789" });
    expect(parseVideoUrl("https://cdn.example.com/clip.mp4")).toMatchObject({ kind: "file" });
    expect(parseVideoUrl("https://www.instagram.com/reel/abc/")).toMatchObject({ kind: "link" });
    expect(parseVideoUrl("javascript:alert(1)")).toBeNull();
    expect(parseVideoUrl("")).toBeNull();
  });
});

describe("formatting", () => {
  it("price labels", () => {
    expect(priceLabel(null, "ON_REQUEST")).toBe("Price on request");
    expect(priceLabel("150", "FROM")).toBe("From $150");
    expect(priceLabel("80", "PER_PERSON")).toBe("$80 per person");
    expect(priceLabel(null, "FIXED")).toBe("Price on request");
  });
  it("contact links", () => {
    expect(instagramUrl("@ocean.x")).toBe("https://instagram.com/ocean.x");
    expect(instagramUrl("")).toBeNull();
    expect(instagramDmUrl("@ocean.x")).toBe("https://ig.me/m/ocean.x");
    expect(instagramDmUrl("https://www.instagram.com/ocean.x/")).toBe("https://ig.me/m/ocean.x");
    expect(instagramDmUrl("")).toBeNull();
    expect(whatsappUrl("+960 777-1234", "Hi")).toBe("https://wa.me/9607771234?text=Hi");
  });
});

describe("slugs", () => {
  it("slugify + uniqueness", async () => {
    expect(slugify("Sea Photography!")).toBe("sea-photography");
    expect(slugify("Maabaidhoo — Lagoon")).toBe("maabaidhoo-lagoon");
    const taken = new Set(["machines", "machines-2"]);
    expect(await uniqueSlug("Machines", async (s) => taken.has(s))).toBe("machines-3");
  });
});

describe("passwords", () => {
  it("hashes with scrypt and verifies", async () => {
    const h = await hashPassword("correct horse battery");
    expect(h).toMatch(/^scrypt\$32768\$8\$1\$/);
    expect(h).not.toContain("correct horse");
    expect(await verifyPassword("correct horse battery", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
    expect(await verifyPassword("x", "garbage")).toBe(false);
  });
});
