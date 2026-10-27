import { getAdmin } from "@/lib/auth";
import { processClip } from "@/lib/clip-process";

// Making a preview takes a few seconds to a minute.
export const maxDuration = 300;
export const runtime = "nodejs";

/** Admin-only: make (or remake) the watermarked preview for a clip. */
export async function POST(req: Request) {
  if (!(await getAdmin())) return Response.json({ error: "Not signed in" }, { status: 401 });
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) return Response.json({ error: "Bad origin" }, { status: 403 });
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id || typeof id !== "string") return Response.json({ error: "Missing clip" }, { status: 400 });
  const r = await processClip(id);
  return Response.json(r, { status: r.ok ? 200 : 400 });
}
