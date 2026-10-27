import { downloadsFor } from "@/lib/delivery";
import { rateLimit } from "@/lib/rate-limit";
import { signedPrivateUrl, storageReady } from "@/lib/storage";
import { isToken } from "@/lib/tokens";

/**
 * Download one original (or delivered file) from a paid order/booking. Sends
 * the browser to a storage link that works for 15 minutes only; the order page
 * itself stops offering downloads after the expiry date.
 */
export async function GET(req: Request, { params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params;
  if (!isToken(token)) return new Response("Not found", { status: 404 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!(await rateLimit(`dl:${ip}`, 300, 3600))) return new Response("Too many downloads — try again later.", { status: 429 });
  const d = await downloadsFor(token);
  if (!d) return new Response("Not found", { status: 404 });
  if (!d.open) return new Response("Downloads for this order aren't open (payment pending or the link expired). Message us on WhatsApp.", { status: 403 });
  const file = d.clips.find((c) => c.id === id) ?? d.files.find((f) => f.id === id);
  if (!file) return new Response("Not found", { status: 404 });
  if (!storageReady()) return new Response("Downloads are temporarily unavailable. Please message us on WhatsApp.", { status: 503 });
  const key = "originalKey" in file ? file.originalKey : file.key;
  const url = await signedPrivateUrl(key, 15 * 60);
  return new Response(null, { status: 302, headers: { location: url, "cache-control": "no-store", "referrer-policy": "no-referrer" } });
}
