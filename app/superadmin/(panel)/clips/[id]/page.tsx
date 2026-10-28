import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { Badge, Card, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { ACTIVE_BOOKING, bookingLabel } from "@/lib/bookings";
import { db } from "@/lib/db";
import { formatDate, formatDateTime } from "@/lib/format";
import { SLOT_LABEL } from "@/lib/shop-rules";
import { deleteClip } from "../actions";
import { ClipEditor } from "./ClipEditor";

export const metadata = { title: "Clip" };

export default async function ClipPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const clip = await db.clip.findUnique({
    where: { id },
    include: {
      location: { select: { name: true } },
      booking: { select: { id: true, reference: true, fullName: true, preferredDate: true, slot: true } },
      orderItems: { include: { session: { include: { order: { select: { id: true, reference: true, status: true, name: true } } } } } },
    },
  });
  if (!clip) notFound();
  const bookings = await db.booking.findMany({
    where: { token: { not: null }, OR: [{ status: { in: ACTIVE_BOOKING } }, { id: clip.bookingId ?? "" }] },
    orderBy: [{ preferredDate: "desc" }],
    take: 100,
    select: { id: true, reference: true, fullName: true, preferredDate: true, slot: true },
  });

  return (
    <>
      <PageHeader
        title={clip.code}
        subtitle={`${formatDate(clip.date)} · ${SLOT_LABEL[clip.slot]} · ${clip.location?.name ?? "No spot"}${clip.seconds ? ` · ${Math.round(clip.seconds)} s` : ""}`}
        back={{ href: "/superadmin/clips", label: "Clips" }}
        actions={
          <ConfirmButton action={async () => { "use server"; return deleteClip(clip.id); }} confirm={`Delete ${clip.code} and its files? This can't be undone.`}>
            Delete
          </ConfirmButton>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-3">
          <div className="overflow-hidden rounded-xl bg-black">
            {clip.previewUrl ? (
              <video src={clip.previewUrl} poster={clip.posterUrl ?? undefined} controls muted playsInline preload="none" className="mx-auto max-h-[70vh] w-full" />
            ) : (
              <p className="p-6 text-center text-sm text-white/70">{clip.status === "FAILED" ? clip.error : "Preview is being made…"}</p>
            )}
          </div>
          <p className="text-xs text-slate">
            Original: {clip.originalName || "—"} · {(clip.originalSize / 1024 / 1024).toFixed(0)} MB · uploaded {formatDateTime(clip.createdAt)}
          </p>
        </div>
        <div className="space-y-6">
          <Card title="Details">
            <ClipEditor
              clip={{ id: clip.id, description: clip.description, bookingId: clip.bookingId, hidden: clip.hidden, status: clip.status }}
              bookings={bookings.map((b) => ({ id: b.id, label: bookingLabel(b) }))}
            />
          </Card>
          {clip.orderItems.length > 0 && (
            <Card title="Bought in">
              <ul className="space-y-2 text-sm">
                {clip.orderItems.map((i) => (
                  <li key={i.id}>
                    <Link href={`/superadmin/orders/${i.session.order.id}`} className="font-medium underline">
                      {i.session.order.reference}
                    </Link>{" "}
                    · {i.session.order.name} <Badge>{i.session.order.status.replace(/_/g, " ").toLowerCase()}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
