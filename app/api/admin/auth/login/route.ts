import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { createAdminSession } from "@/lib/auth/admin";
import { db } from "@/lib/db";
import { dummyPasswordHash, hashIp, verifyPassword } from "@/lib/crypto";
import { unauthorized } from "@/lib/errors";
import { assertSameOrigin, clientIp, parseJson, route } from "@/lib/http";
import { enforce, resetRateLimit, RULES } from "@/lib/rate-limit";

const schema = z.object({ email: z.string().trim().toLowerCase().email().max(254), password: z.string().min(1).max(256) });

export const POST = route(async (req) => {
  assertSameOrigin(req);
  const ip = hashIp(clientIp(req)) ?? "unknown";
  await enforce(RULES.adminLogin, ip);
  const { email, password } = await parseJson(req, schema);
  await enforce(RULES.adminLogin, `email:${email}`);
  const admin = await db.adminUser.findUnique({ where: { email } });
  // constant-time-ish: always run one scrypt verification
  const ok = await verifyPassword(password, admin?.passwordHash ?? (await dummyPasswordHash()));
  if (!admin || !ok || admin.disabledAt) {
    await audit({ action: "LOGIN_FAILED", actorType: "ADMIN", actorId: admin?.id ?? null, details: { email }, ipHash: ip });
    throw unauthorized("Invalid email or password");
  }
  const res = NextResponse.json({ ok: true, admin: { id: admin.id, name: admin.name, email: admin.email } });
  await createAdminSession(admin.id, req, res);
  await db.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
  await resetRateLimit(RULES.adminLogin, `email:${email}`);
  await audit({ action: "LOGIN", actorType: "ADMIN", actorId: admin.id, ipHash: ip });
  return res;
});
