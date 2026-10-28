import { cleanupOldFiles } from "@/lib/cleanup";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Daily Vercel Cron: delete old clips so storage doesn't fill up. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  return Response.json(await cleanupOldFiles());
}
