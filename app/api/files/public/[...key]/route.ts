import { storageReady, guessType, readLocalPublic, storageDriver } from "@/lib/storage";

/** Development/test only: serves previews stored on disk (production uses Vercel Blob). */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  if (!storageReady() || storageDriver() !== "local") return new Response("Not found", { status: 404 });
  const key = (await params).key.join("/");
  const body = await readLocalPublic(key).catch(() => null);
  if (!body) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(body), { headers: { "content-type": guessType(key), "cache-control": "public, max-age=3600" } });
}
