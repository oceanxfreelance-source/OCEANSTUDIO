import type { AdminUser } from "@prisma/client";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";
import { db } from "../db";
import { now } from "../clock";
import { hashIp, hashToken, randomToken } from "../crypto";
import { unauthorized } from "../errors";
import { assertSameOrigin, clientIp } from "../http";
import { enforce, RULES } from "../rate-limit";
import { cookieName, cookieOptions } from "./cookies";

export const ADMIN_SESSION_HOURS = 12;
export const adminCookie = () => cookieName("ox_admin");

export type AdminContext = { admin: Pick<AdminUser, "id" | "email" | "name" | "role">; sessionId: string };

export async function createAdminSession(adminId: string, req: Request, res: NextResponse): Promise<void> {
  const token = randomToken(48);
  const expiresAt = new Date(now().getTime() + ADMIN_SESSION_HOURS * 3600 * 1000);
  await db.session.create({
    data: {
      tokenHash: hashToken(token),
      kind: "ADMIN",
      adminUserId: adminId,
      expiresAt,
      ipHash: hashIp(clientIp(req)),
      userAgent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
    },
  });
  res.cookies.set(adminCookie(), token, cookieOptions(expiresAt));
}

async function resolveAdminToken(token: string | undefined): Promise<AdminContext | null> {
  if (!token || token.length > 128) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { adminUser: { select: { id: true, email: true, name: true, role: true, disabledAt: true } } },
  });
  if (!session || session.kind !== "ADMIN" || !session.adminUser) return null;
  if (session.revokedAt || session.expiresAt <= now() || session.adminUser.disabledAt) return null;
  const { disabledAt: _ignored, ...admin } = session.adminUser;
  return { admin, sessionId: session.id };
}

/** For API routes: verifies the session in the database, CSRF origin and rate limit. */
export async function requireAdmin(req: NextRequest): Promise<AdminContext> {
  assertSameOrigin(req);
  const ctx = await resolveAdminToken(req.cookies.get(adminCookie())?.value);
  if (!ctx) throw unauthorized("Admin authentication required");
  await enforce(RULES.adminApi, ctx.admin.id);
  return ctx;
}

/** For server components / layouts. */
export async function getAdminFromCookies(): Promise<AdminContext | null> {
  const store = await cookies();
  return resolveAdminToken(store.get(adminCookie())?.value);
}

export async function destroyAdminSession(req: NextRequest, res: NextResponse): Promise<void> {
  const token = req.cookies.get(adminCookie())?.value;
  if (token) await db.session.updateMany({ where: { tokenHash: hashToken(token) }, data: { revokedAt: now() } });
  res.cookies.set(adminCookie(), "", { ...cookieOptions(new Date(0)), maxAge: 0 });
}
