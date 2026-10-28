import Link from "next/link";
import { PAYMENT_LABEL } from "@/lib/shop-rules";
import { notFound } from "next/navigation";
import { DeliveryFileUpload } from "@/components/admin/DeliveryFileUpload";
import { Badge, Card, PageHeader } from "@/components/admin/ui";
import { cx } from "@/components/ui/cx";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatDateTime, money, whatsappUrl } from "@/lib/format";
import { ORDER_STATUS } from "@/lib/orders";
import { ORDER_PACKAGE_LABEL, SLOT_LABEL } from "@/lib/shop-rules";
import { siteUrl } from "@/lib/site";
import { storageDriver, storageReady } from "@/lib/storage";
import { cancelOrder, markOrderDelivered, markOrderPaid, markOrderUnpaid, reopenOrderDownloads } from "../actions";
import { AddClipsForm } from "./AddClipsForm";

export const metadata = { title: "Order" };

function Btn({ action, children, tone = "secondary" }: { action: () => Promise<void>; children: React.ReactNode; tone?: "primary" | "secondary" | "danger" }) {
  return (
    <form action={action}>
      <button className={cx("rounded-lg px-4 py-2.5 text-sm font-semibold", tone === "primary" ? "bg-abyss text-white" : tone === "danger" ? "border border-red-200 bg-white text-red-700" : "border border-slate/30 bg-white hover:bg-foam")}>{children}</button>
    </form>
  );
}

export default async function OrderAdmin({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const o = await db.order.findUnique({
    where: { id },
    include: {
      sessions: { orderBy: [{ date: "asc" }, { slot: "asc" }], include: { location: { select: { name: true } }, items: { include: { clip: { select: { id: true, posterUrl: true } } } } } },
      slips: { orderBy: { createdAt: "desc" } },
      files: true,
    },
  });
  if (!o) notFound();
  const link = `${siteUrl()}/order/${o.token}`;
  const first = o.name.split(" ")[0];
  const wa = whatsappUrl(o.whatsapp, o.status === "AWAITING_PAYMENT" ? `Hi ${first}, it's Ocean X about your order ${o.reference}: ${link}` : `Hi ${first}! Your Ocean X clips are ready to download 🌊 ${link}`);
  const mail = o.email ? `mailto:${o.email}?subject=${encodeURIComponent(`Your Ocean X clips — ${o.reference}`)}&body=${encodeURIComponent(`Hi ${first},\n\nYour clips: ${link}\n\nOcean X`)}` : null;

  return (
    <>
      <PageHeader
        title={`${o.name} · ${money(o.total)}`}
        subtitle={`${o.reference} · ordered ${formatDateTime(o.createdAt)} · ${PAYMENT_LABEL[o.paymentMethod]}`}
        back={{ href: "/superadmin/orders", label: "Orders" }}
        actions={
          <a href={link} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-slate/30 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-foam">
            Customer&apos;s page ↗
          </a>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card title="Status">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={ORDER_STATUS[o.status][1]}>{ORDER_STATUS[o.status][0]}</Badge>
              {o.downloadsUntil && <span className="text-xs text-slate">Downloads until {formatDate(o.downloadsUntil)}</span>}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {o.status === "AWAITING_PAYMENT" && (
                <>
                  <Btn action={markOrderPaid.bind(null, o.id)} tone="primary">
                    Mark paid — open downloads
                  </Btn>
                  <Btn action={cancelOrder.bind(null, o.id)} tone="danger">
                    Cancel order
                  </Btn>
                </>
              )}
              {o.status === "PAID" && (
                <Btn action={markOrderDelivered.bind(null, o.id)} tone="primary">
                  Mark delivered
                </Btn>
              )}
              {(o.status === "PAID" || o.status === "DELIVERED") && (
                <>
                  <Btn action={reopenOrderDownloads.bind(null, o.id)}>Reopen downloads</Btn>
                  <Btn action={markOrderUnpaid.bind(null, o.id)}>Mark unpaid</Btn>
                </>
              )}
              {o.status === "CANCELLED" && <Btn action={markOrderUnpaid.bind(null, o.id)}>Reopen order</Btn>}
            </div>
            {o.status === "PAID" && <p className="mt-3 text-xs text-slate">Add the rest of their clips{o.sessions.some((s) => s.package === "SESSION_REEL") ? " and upload the reel" : ""}, then mark delivered and send them the link.</p>}
          </Card>

          {o.sessions.map((s) => (
            <Card key={s.id} title={`${s.location?.name ?? "Ocean X"} · ${SLOT_LABEL[s.slot]} · ${formatDate(s.date, { day: "numeric", month: "short" })}`} actions={<span className="text-sm">{ORDER_PACKAGE_LABEL[s.package]} · {money(s.price)}</span>}>
              <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                {s.items.map((i) => (
                  <li key={i.id}>
                    {i.clip ? (
                      <Link href={`/superadmin/clips/${i.clip.id}`} className="block">
                        <span className="block aspect-[4/5] overflow-hidden rounded bg-ink">
                          {i.clip.posterUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={i.clip.posterUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                          )}
                        </span>
                        <span className="mt-1 block font-mono text-[11px]">{i.clipCode}</span>
                      </Link>
                    ) : (
                      <span className="block font-mono text-[11px] text-slate">{i.clipCode} (deleted)</span>
                    )}
                  </li>
                ))}
              </ul>
              {s.package !== "CLIPS" && <AddClipsForm orderId={o.id} sessionId={s.id} />}
            </Card>
          ))}

          <Card title="Edited reel / extra files">
            {o.files.length > 0 && (
              <ul className="mb-3 space-y-1 text-sm">
                {o.files.map((f) => (
                  <li key={f.id}>📎 {f.name}</li>
                ))}
              </ul>
            )}
            {storageReady() && <DeliveryFileUpload orderId={o.id} driver={storageDriver()} />}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Customer">
            <p className="text-sm font-medium">{o.name}</p>
            <p className="text-sm">{o.whatsapp ?? ""}</p>
            <p className="text-sm">{o.email ?? ""}</p>
            {o.note && <p className="mt-2 whitespace-pre-line rounded bg-foam p-2 text-sm">{o.note}</p>}
            {o.partnerRef && <p className="mt-2 text-xs text-slate">Referred by {o.partnerRef}</p>}
            <div className="mt-3 space-y-2">
              {wa && (
                <a href={wa} target="_blank" rel="noopener noreferrer" className="block rounded-lg bg-[#25D366] px-4 py-2.5 text-center text-sm font-semibold text-black">
                  Message on WhatsApp
                </a>
              )}
              {mail && (
                <a href={mail} className="block rounded-lg border border-slate/30 px-4 py-2.5 text-center text-sm font-semibold">
                  Email the link
                </a>
              )}
            </div>
          </Card>
          <Card title={`Payment slips (${o.slips.length})`}>
            {o.slips.length === 0 ? (
              <p className="text-sm text-slate">{o.paymentMethod === "CASH" ? "Paying cash." : "None uploaded yet."}</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {o.slips.map((s) => (
                  <li key={s.id}>
                    <a href={`/api/admin/slips/${s.id}`} target="_blank" rel="noopener noreferrer" className="text-gold-deep underline">
                      {s.mimeType === "application/pdf" ? "PDF slip" : "Slip photo"} · {formatDateTime(s.createdAt)}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
