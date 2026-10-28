"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import type { FormState } from "@/lib/forms";
import { getShopConfig } from "@/lib/shop";

function refresh(id: string) {
  revalidatePath("/superadmin", "layout");
  revalidatePath(`/superadmin/orders/${id}`);
}

/** Payment received: downloads open now. Orders of chosen clips only are then complete. */
export async function markOrderPaid(id: string) {
  await requireAdmin();
  const cfg = await getShopConfig();
  const o = await db.order.findUniqueOrThrow({ where: { id }, select: { sessions: { select: { package: true } }, paidAt: true } });
  const onlyClips = o.sessions.every((s) => s.package === "CLIPS");
  await db.order.update({
    where: { id },
    data: {
      status: onlyClips ? "DELIVERED" : "PAID",
      paidAt: o.paidAt ?? new Date(),
      deliveredAt: onlyClips ? new Date() : null,
      downloadsUntil: new Date(Date.now() + cfg.downloadDays * 86400_000),
    },
  });
  refresh(id);
}

export async function markOrderDelivered(id: string) {
  await requireAdmin();
  await db.order.update({ where: { id }, data: { status: "DELIVERED", deliveredAt: new Date() } });
  refresh(id);
}

export async function markOrderUnpaid(id: string) {
  await requireAdmin();
  await db.order.update({ where: { id }, data: { status: "AWAITING_PAYMENT", paidAt: null, deliveredAt: null, downloadsUntil: null } });
  refresh(id);
}

export async function cancelOrder(id: string) {
  await requireAdmin();
  await db.order.update({ where: { id }, data: { status: "CANCELLED", downloadsUntil: null } });
  refresh(id);
}

export async function reopenOrderDownloads(id: string) {
  await requireAdmin();
  const cfg = await getShopConfig();
  await db.order.update({ where: { id }, data: { downloadsUntil: new Date(Date.now() + cfg.downloadDays * 86400_000) } });
  refresh(id);
}

/** Full-session orders: add the surfer's other clips by code (e.g. "MC-2710-03, MC-2710-09"). */
export async function addClipsToOrder(orderId: string, sessionId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const codes = [...new Set(String(fd.get("codes") ?? "").toUpperCase().split(/[\s,;]+/).filter(Boolean))].slice(0, 50);
  if (!codes.length) return { error: "Enter one or more clip codes." };
  const clips = await db.clip.findMany({ where: { code: { in: codes } }, select: { id: true, code: true } });
  const missing = codes.filter((c) => !clips.some((x) => x.code === c));
  const session = await db.orderSession.findFirst({ where: { id: sessionId, orderId }, select: { id: true, items: { select: { clipId: true } } } });
  if (!session) return { error: "Session not found." };
  const have = new Set(session.items.map((i) => i.clipId));
  const add = clips.filter((c) => !have.has(c.id));
  if (add.length) await db.orderItem.createMany({ data: add.map((c) => ({ sessionId, clipId: c.id, clipCode: c.code })) });
  refresh(orderId);
  return missing.length ? { error: `Added ${add.length}. Not found: ${missing.join(", ")}` } : { ok: true, message: `Added ${add.length} clip${add.length === 1 ? "" : "s"}.` };
}
