import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { env } from "./env";

// ---------------------------------------------------------------------------
// Password hashing (scrypt, memory-hard). Format: scrypt$N$r$p$saltB64$hashB64
// ---------------------------------------------------------------------------
const SCRYPT_N = 1 << 15;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;

function scryptAsync(password: string, salt: Buffer, N: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, KEY_LEN, { N, r, p, maxmem: 256 * N * r }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 8) throw new Error("Password must be at least 8 characters");
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, SCRYPT_N, SCRYPT_R, SCRYPT_P);
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, hashB64] = parts as [string, string, string, string, string, string];
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scryptAsync(password, Buffer.from(saltB64, "base64"), Number(n), Number(r), Number(p));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** A precomputed hash used to keep login timing uniform when the account does not exist. */
let dummyHash: Promise<string> | null = null;
export function dummyPasswordHash(): Promise<string> {
  dummyHash ??= hashPassword("oceanx-dummy-password-for-timing");
  return dummyHash;
}

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/** URL-safe random token without ambiguous characters. 32 chars ≈ 185 bits of entropy. */
export function randomToken(length = 32): string {
  const out: string[] = [];
  while (out.length < length) {
    const bytes = randomBytes(length * 2);
    for (const b of bytes) {
      // rejection sampling to avoid modulo bias
      if (b < 256 - (256 % ALPHABET.length)) out.push(ALPHABET[b % ALPHABET.length]!);
      if (out.length === length) break;
    }
  }
  return out.join("");
}

/** Human-friendly delivery password: 4 groups of 4, e.g. "K7mQ-2xhP-9Tzc-Wb4d" (~94 bits). */
export function randomPassword(): string {
  const t = randomToken(16);
  return `${t.slice(0, 4)}-${t.slice(4, 8)}-${t.slice(8, 12)}-${t.slice(12, 16)}`;
}

export function sha256Hex(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Keyed hash for session/delivery tokens stored in the database. */
export function hashToken(token: string): string {
  return createHmac("sha256", env().AUTH_SECRET).update(`token:${token}`).digest("hex");
}

/** Privacy-preserving IP fingerprint for audit/rate-limit records. */
export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return createHmac("sha256", env().AUTH_SECRET).update(`ip:${ip}`).digest("hex").slice(0, 32);
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

// ---------------------------------------------------------------------------
// Symmetric encryption (AES-256-GCM) for values the admin must be able to copy
// again later (delivery link token & password). Plain text is never stored.
// ---------------------------------------------------------------------------
function encryptionKey(): Buffer {
  const e = env();
  const material = e.DELIVERY_ENCRYPTION_KEY ?? e.AUTH_SECRET;
  return createHash("sha256").update(`oceanx-delivery-key:${material}`).digest();
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${ct.toString("base64url")}.${tag.toString("base64url")}`;
}

export function decrypt(payload: string): string {
  const [v, ivB, ctB, tagB] = payload.split(".");
  if (v !== "v1" || !ivB || !ctB || !tagB) throw new Error("Unsupported ciphertext");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivB, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ctB, "base64url")), decipher.final()]).toString("utf8");
}
