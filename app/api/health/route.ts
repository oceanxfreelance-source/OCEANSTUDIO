import { db } from "@/lib/db";
import { json, route } from "@/lib/http";

export const GET = route(async () => {
  await db.$queryRaw`SELECT 1`;
  return json({ ok: true, time: new Date().toISOString() });
});
