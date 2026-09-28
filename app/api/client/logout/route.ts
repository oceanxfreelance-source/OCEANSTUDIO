import { NextResponse } from "next/server";
import { z } from "zod";
import { destroyClientSession } from "@/lib/auth/client";
import { assertSameOrigin, parseJson, route } from "@/lib/http";

export const POST = route(async (req) => {
  assertSameOrigin(req);
  const { token } = await parseJson(req, z.object({ token: z.string().min(1).max(64) }));
  const res = NextResponse.json({ ok: true });
  await destroyClientSession(req, token, res);
  return res;
});
