import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { createClientSession, deliveryState, findDeliveryByToken } from "@/lib/auth/client";
import { dummyPasswordHash, hashIp, verifyPassword } from "@/lib/crypto";
import { gone, notFound, unauthorized } from "@/lib/errors";
import { assertSameOrigin, clientIp, json, parseJson, route } from "@/lib/http";
import { enforce, RULES } from "@/lib/rate-limit";

const schema = z.object({ token: z.string().min(1).max(64), password: z.string().min(1).max(256) });

/** Private URL + password → HttpOnly session bound to this one delivery (and capped at its expiry). */
export const POST = route(async (req) => {
  assertSameOrigin(req);
  const ip = hashIp(clientIp(req)) ?? "unknown";
  await enforce(RULES.clientLogin, ip);
  const { token, password } = await parseJson(req, schema);
  await enforce(RULES.clientLogin, `token:${token.slice(0, 64)}`);
  const delivery = await findDeliveryByToken(token);
  const state = deliveryState(delivery);
  const ok = await verifyPassword(password, delivery?.passwordHash ?? (await dummyPasswordHash()));
  if (!delivery || state === "not_found") throw notFound("Gallery not found");
  if (state === "expired" || state === "revoked") throw gone("This private gallery was available for 48 hours and is no longer accessible.");
  if (!ok) {
    await audit({ action: "CLIENT_LOGIN_FAILED", actorType: "CLIENT", deliveryId: delivery.id, projectId: delivery.projectId, ipHash: ip });
    throw unauthorized("Incorrect password");
  }
  if (state !== "ok") return json({ ok: false, preparing: true }, 202);
  const res = NextResponse.json({ ok: true });
  await createClientSession(delivery, token, req, res);
  await audit({ action: "CLIENT_LOGIN", actorType: "CLIENT", deliveryId: delivery.id, projectId: delivery.projectId, ipHash: ip });
  return res;
});
