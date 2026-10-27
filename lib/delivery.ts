import "server-only";
import { db } from "./db";

/**
 * What a private order/booking link may download right now. Originals are only
 * offered once payment is confirmed and until the link's expiry date.
 */
export async function downloadsFor(token: string) {
  const order = await db.order.findUnique({
    where: { token },
    select: {
      status: true,
      downloadsUntil: true,
      sessions: { select: { items: { select: { clip: { select: { id: true, code: true, originalKey: true, originalName: true } } } } } },
      files: { select: { id: true, key: true, name: true } },
    },
  });
  if (order) {
    const open = (order.status === "PAID" || order.status === "DELIVERED") && !!order.downloadsUntil && order.downloadsUntil > new Date();
    const clips = order.sessions.flatMap((s) => s.items.map((i) => i.clip).filter((c): c is NonNullable<typeof c> => !!c));
    return { open, until: order.downloadsUntil, clips, files: order.files };
  }
  const booking = await db.booking.findUnique({
    where: { token },
    select: {
      status: true,
      paymentStatus: true,
      downloadsUntil: true,
      clips: { where: { status: "READY" }, orderBy: { code: "asc" }, select: { id: true, code: true, originalKey: true, originalName: true } },
      files: { select: { id: true, key: true, name: true } },
    },
  });
  if (booking) {
    const open = (booking.status === "READY" || booking.status === "COMPLETED") && booking.paymentStatus === "PAID" && !!booking.downloadsUntil && booking.downloadsUntil > new Date();
    return { open, until: booking.downloadsUntil, clips: booking.clips, files: booking.files };
  }
  return null;
}
