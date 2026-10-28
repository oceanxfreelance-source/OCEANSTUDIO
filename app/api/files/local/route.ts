import { storageReady, readPrivate, storageDriver, verifyLocal } from "@/lib/storage";

/** Development/test only: the local stand-in for signed, expiring private links. */
export async function GET(req: Request) {
  if (!storageReady() || storageDriver() !== "local") return new Response("Not found", { status: 404 });
  const u = new URL(req.url);
  const key = u.searchParams.get("key") ?? "";
  const exp = u.searchParams.get("exp") ?? "";
  if (!verifyLocal(`${key}|${exp}`, u.searchParams.get("sig") ?? "")) return new Response("Bad link", { status: 403 });
  if (Number(exp) < Date.now()) return new Response("This link has expired", { status: 410 });
  const file = await readPrivate(key);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(file.stream, { headers: { "content-type": file.contentType, ...(file.size ? { "content-length": String(file.size) } : {}) } });
}
