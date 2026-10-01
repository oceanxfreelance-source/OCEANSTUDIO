import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./db";
import { getDummyHash, verifyPassword } from "./password";
import { clearRateLimit, rateLimit } from "./rate-limit";

/**
 * Superadmin authentication.
 *
 * - Passwords are scrypt-hashed in the database (never in frontend code).
 * - Login creates a random 32-byte token. The browser gets it in an HttpOnly,
 *   SameSite=Lax cookie; the database stores only its SHA-256 hash.
 * - Every admin page AND every admin action calls requireAdmin(), which checks
 *   the session in the database. Hiding the /superadmin URL is not relied on.
 */

export const SESSION_COOKIE = "ox_admin";
const SESSION_DAYS = 7;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

export type LoginResult = { ok: true } | { ok: false; error: string };

export async function login(email: string, password: string): Promise<LoginResult> {
  const ip = await clientIp();
  const normalized = email.trim().toLowerCase();
  // 10 attempts per 15 minutes per IP, and per email.
  const allowedIp = await rateLimit(`login:ip:${ip}`, 10, 15 * 60);
  const allowedEmail = await rateLimit(`login:email:${normalized}`, 10, 15 * 60);
  if (!allowedIp || !allowedEmail) return { ok: false, error: "Too many attempts. Please wait 15 minutes and try again." };

  const admin = await db.adminUser.findUnique({ where: { email: normalized } });
  const valid = await verifyPassword(password, admin?.passwordHash ?? (await getDummyHash()));
  if (!admin || !valid) return { ok: false, error: "Incorrect email or password." };

  // A successful login resets both counters (only failed guesses should add up).
  await clearRateLimit(`login:email:${normalized}`);
  await clearRateLimit(`login:ip:${ip}`);
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000);
  const ua = (await headers()).get("user-agent")?.slice(0, 300) ?? null;
  await db.adminSession.create({ data: { tokenHash: sha256(token), adminId: admin.id, expiresAt, userAgent: ua } });
  await db.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
  // Clean up this admin's expired sessions.
  await db.adminSession.deleteMany({ where: { adminId: admin.id, expiresAt: { lt: new Date() } } });

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  return { ok: true };
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.adminSession.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(SESSION_COOKIE);
}

export type CurrentAdmin = { id: string; email: string; name: string; role: "OWNER" | "STAFF" };

/** The logged-in admin, or null. Cached for the duration of one request. */
export const getAdmin = cache(async (): Promise<CurrentAdmin | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.adminSession.findUnique({
    where: { tokenHash: sha256(token) },
    include: { admin: { select: { id: true, email: true, name: true, role: true } } },
  });
  if (!session || session.expiresAt <= new Date()) return null;
  return session.admin;
});

/** Use at the top of every admin page and server action. */
export async function requireAdmin(): Promise<CurrentAdmin> {
  const admin = await getAdmin();
  if (!admin) redirect("/superadmin/login");
  return admin;
}
