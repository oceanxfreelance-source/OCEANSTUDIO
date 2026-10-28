import { getAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { readPrivate } from "@/lib/storage";

/** Admin-only: view an uploaded payment slip. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdmin())) return new Response("Not signed in", { status: 401 });
  const slip = await db.paymentSlip.findUnique({ where: { id: (await params).id } });
  if (!slip) return new Response("Not found", { status: 404 });
  const file = await readPrivate(slip.key);
  if (!file) return new Response("File missing", { status: 404 });
  return new Response(file.stream, { headers: { "content-type": slip.mimeType, "content-disposition": "inline", "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
}
