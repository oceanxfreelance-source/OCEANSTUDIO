import { describe, expect, it } from "vitest";
import { decrypt, encrypt, hashPassword, hashToken, randomPassword, randomToken, verifyPassword } from "@/lib/crypto";

describe("password hashing", () => {
  it("hashes with scrypt and verifies", async () => {
    const h = await hashPassword("correct horse battery");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(h).not.toContain("correct horse");
    expect(await verifyPassword("correct horse battery", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
  });
  it("salts every hash", async () => {
    expect(await hashPassword("same-password")).not.toEqual(await hashPassword("same-password"));
  });
  it("rejects malformed hashes", async () => {
    expect(await verifyPassword("x", "plain-text")).toBe(false);
  });
});

describe("tokens", () => {
  it("generates unguessable URL-safe tokens", () => {
    const t = randomToken(32);
    expect(t).toMatch(/^[A-Za-z0-9]{32}$/);
    const set = new Set(Array.from({ length: 2000 }, () => randomToken(32)));
    expect(set.size).toBe(2000);
  });
  it("keyed token hashes are deterministic and not the token", () => {
    const t = randomToken();
    expect(hashToken(t)).toEqual(hashToken(t));
    expect(hashToken(t)).not.toContain(t);
  });
  it("passwords are grouped and random", () => {
    expect(randomPassword()).toMatch(/^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/);
  });
});

describe("AES-GCM secrets", () => {
  it("round-trips and detects tampering", () => {
    const c = encrypt("K7mQ-2xhP-9Tzc-Wb4d");
    expect(c).not.toContain("K7mQ");
    expect(decrypt(c)).toBe("K7mQ-2xhP-9Tzc-Wb4d");
    const parts = c.split(".");
    parts[2] = Buffer.from("tampered").toString("base64url");
    expect(() => decrypt(parts.join("."))).toThrow();
  });
});
