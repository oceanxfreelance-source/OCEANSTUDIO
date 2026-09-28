import { env } from "@/lib/env";
import { safeEqual } from "@/lib/crypto";
import { unauthorized } from "@/lib/errors";
import { json, route } from "@/lib/http";
import { runDeliveryCleanup } from "@/server/cleanup";

export const maxDuration = 60;

/**
 * Vercel Cron entry point (see vercel.json). Complements the worker's
 * scheduled sweep; both are idempotent and lease-protected, so running both is safe.
 */
export const GET = route(async (req) => {
  const secret = env().CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) throw unauthorized();
  const reports = await runDeliveryCleanup(25);
  return json({ processed: reports.length, reports });
});
