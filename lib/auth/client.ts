import type { Delivery, Session } from "@prisma/client";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";
import { db } from "../db";
import { now } from "../clock";
import { hashIp, hashToken, randomToken, sha256Hex } from "../crypto";
import { gone, notFound, unauthorized } from "../errors";
import { assertSameOrigin, clientIp } from "../http";
import { enforce, RULES } from "../rate-limit";
import { cookieName, cookieOptions } from "./cookies";

export const DELIVERY_TOKEN_RE = /^[A-Za-z0-9]{32}$/;

export type DeliveryAccessState = "ok" | "not_found" | "expired" | "revoked" | "preparing" | "unavailable";

/**
 * Server-side access decision. Expiration is evaluated against expires_at on
 * EVERY request — it never waits for the cleanup worker to run.
 */
export function deliveryState(d: Pick<Delivery, "status" | "expiresAt"> | null, at: Date = now()): DeliveryAccessState {
  if (!d) return "not_found";
  if (d.status === "REVOKED") return "revoked";
  if (at.getTime() >= d.expiresAt.getTime()) return "expired";
  if (d.status === "EXPIRED" || d.status === "DELETING" || d.status === "DELETED") return "expired";
  if (d.status === "PREPARING") return "preparing";
  if (d.status === "FAILED") return "unavailable";
  return "ok";
}

export async function findDeliveryByToken(token: string): Promise<Delivery | null> {
  if (!DELIVERY_TOKEN_RE.test(token)) return null;
  return db.delivery.findUnique({ where: { secureTokenHash: hashToken(token) } });
}

/** One cookie per gallery so a browser can hold several galleries without mixing them. */
export function galleryCookie(token: string): string {
  return cookieName(`ox_g_${sha256Hex(`gallery:${token}`).slice(0, 16)}`);
}

export async function createClientSession(delivery: Delivery, token: string, req: Request, res: NextResponse) {
  const sessionToken = randomToken(48);
  await db.session.create({
    data: {
      tokenHash: hashToken(sessionToken),
      kind: "CLIENT",
      deliveryId: delivery.id,
      expiresAt: delivery.expiresAt, // a client session can never outlive its delivery
      ipHash: hashIp(clientIp(req)),
      userAgent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
    },
  });
  res.cookies.set(galleryCookie(token), sessionToken, cookieOptions(delivery.expiresAt));
}

export interface ClientContext {
  delivery: Delivery;
  session: Session;
}

async function resolveSession(delivery: Delivery, sessionToken: string | undefined): Promise<Session | null> {
  if (!sessionToken || sessionToken.length > 128) return null;
  const session = await db.session.findUnique({ where: { tokenHash: hashToken(sessionToken) } });
  if (!session || session.kind !== "CLIENT" || session.deliveryId !== delivery.id) return null;
  if (session.revokedAt || session.expiresAt <= now()) return null;
  return session;
}

/**
 * Verifies, in order: delivery token → delivery exists → not revoked →
 * not expired (server clock) → ready → client session cookie bound to THIS
 * delivery (created only after password verification). Resource ownership
 * (file ∈ delivery) is enforced by the callers' queries, which always filter
 * by ctx.delivery.id.
 */
export async function requireClient(req: NextRequest, token: string): Promise<ClientContext> {
  assertSameOrigin(req);
  await enforce(RULES.galleryAccess, hashIp(clientIp(req)) ?? "unknown");
  const delivery = await findDeliveryByToken(token);
  const state = deliveryState(delivery);
  if (state === "not_found" || !delivery) throw notFound("Gallery not found");
  if (state === "expired") throw gone("This private gallery has expired.");
  if (state === "revoked") throw gone("This private gallery is no longer available.");
  if (state !== "ok") throw notFound("This gallery is not available yet.");
  const session = await resolveSession(delivery, req.cookies.get(galleryCookie(token))?.value);
  if (!session) throw unauthorized("Please enter the gallery password.");
  return { delivery, session };
}

/** Server-component variant: returns the state instead of throwing. */
export async function getClientAccess(token: string): Promise<
  | { state: "ok"; delivery: Delivery; session: Session }
  | { state: "login"; delivery: Delivery }
  | { state: Exclude<DeliveryAccessState, "ok">; delivery: Delivery | null }
> {
  const delivery = await findDeliveryByToken(token);
  const state = deliveryState(delivery);
  if (state !== "ok" || !delivery) return { state: state === "ok" ? "not_found" : state, delivery };
  const store = await cookies();
  const session = await resolveSession(delivery, store.get(galleryCookie(token))?.value);
  if (!session) return { state: "login", delivery };
  return { state: "ok", delivery, session };
}

export async function destroyClientSession(req: NextRequest, token: string, res: NextResponse): Promise<void> {
  const name = galleryCookie(token);
  const value = req.cookies.get(name)?.value;
  if (value) await db.session.updateMany({ where: { tokenHash: hashToken(value) }, data: { revokedAt: now() } });
  res.cookies.set(name, "", { ...cookieOptions(new Date(0)), maxAge: 0 });
}
