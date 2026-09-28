import { NextResponse } from "next/server";
import { destroyAdminSession } from "@/lib/auth/admin";
import { assertSameOrigin, route } from "@/lib/http";

export const POST = route(async (req) => {
  assertSameOrigin(req);
  const res = NextResponse.json({ ok: true });
  await destroyAdminSession(req, res);
  return res;
});
