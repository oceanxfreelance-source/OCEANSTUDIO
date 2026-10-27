import { revalidatePath } from "next/cache";
import sharp from "sharp";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { putPrivate, storageReady } from "@/lib/storage";
import { isToken } from "@/lib/tokens";

export const runtime = "nodejs";

const MAX_BYTES = 4 * 1024 * 1024; // keep under the 4.5 MB request limit; the page shrinks photos first

/** A surfer uploads a bank-transfer slip (photo or PDF) to their order or booking. Stored privately. */
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  if (!(await rateLimit(`slip:${ip}`, 20, 3600))) return Response.json({ error: "Too many uploads. Please try again later." }, { status: 429 });

  if (!storageReady()) return Response.json({ error: "Slip upload isn't available right now — please send your slip on WhatsApp." }, { status: 503 });
  const form = await req.formData().catch(() => null);
  const token = String(form?.get("token") ?? "");
  const file = form?.get("file");
  if (!isToken(token) || !(file instanceof File)) return Response.json({ error: "Please choose your slip." }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "That file is too large (max 4 MB). Try a screenshot or photo instead." }, { status: 413 });

  const [order, booking] = await Promise.all([
    db.order.findUnique({ where: { token }, select: { id: true, reference: true, status: true, _count: { select: { slips: true } } } }),
    db.booking.findUnique({ where: { token }, select: { id: true, reference: true, status: true, _count: { select: { slips: true } } } }),
  ]);
  const target = order ?? booking;
  if (!target) return Response.json({ error: "Order not found." }, { status: 404 });
  if (["CANCELLED", "DECLINED"].includes(target.status)) return Response.json({ error: "This order is cancelled." }, { status: 400 });
  if (target._count.slips >= 6) return Response.json({ error: "We already have several slips for this — message us on WhatsApp if you need to send another." }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  let body: Buffer;
  let mimeType: string;
  if (buf.subarray(0, 5).toString() === "%PDF-") {
    body = buf;
    mimeType = "application/pdf";
  } else {
    try {
      // Re-encode photos: checks it's really an image and strips camera/GPS data.
      body = await sharp(buf, { failOn: "error" }).rotate().resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
      mimeType = "image/jpeg";
    } catch {
      return Response.json({ error: "Please upload a photo, screenshot or PDF of your slip." }, { status: 400 });
    }
  }
  const key = await putPrivate(`slips/${target.reference.toLowerCase()}-${Date.now()}.${mimeType === "application/pdf" ? "pdf" : "jpg"}`, body, mimeType);
  await db.paymentSlip.create({ data: { key, mimeType, size: body.length, ...(order ? { orderId: order.id } : { bookingId: booking!.id }) } });
  revalidatePath("/superadmin", "layout");
  return Response.json({ ok: true });
}
