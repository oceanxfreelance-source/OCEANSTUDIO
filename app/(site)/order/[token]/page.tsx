import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/site/shop/CopyButton";
import { SlipUpload } from "@/components/site/shop/SlipUpload";
import { Steps } from "@/components/site/shop/Steps";
import { db } from "@/lib/db";
import { formatDate, money, whatsappUrl } from "@/lib/format";
import { getShopConfig } from "@/lib/shop";
import { ORDER_PACKAGE_LABEL, SLOT_LABEL } from "@/lib/shop-rules";
import { siteUrl } from "@/lib/site";
import { isToken } from "@/lib/tokens";

export const metadata: Metadata = { title: "Your order", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function OrderPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ new?: string }> }) {
  const { token } = await params;
  if (!isToken(token)) notFound();
  const [order, cfg] = await Promise.all([
    db.order.findUnique({
      where: { token },
      include: {
        sessions: { include: { location: { select: { name: true } }, items: { include: { clip: { select: { id: true, posterUrl: true } } } } }, orderBy: [{ date: "asc" }, { slot: "asc" }] },
        files: { select: { id: true, name: true } },
        _count: { select: { slips: true } },
      },
    }),
    getShopConfig(),
  ]);
  if (!order) notFound();
  const { new: isNew } = await searchParams;

  const paid = order.status === "PAID" || order.status === "DELIVERED";
  const open = paid && !!order.downloadsUntil && order.downloadsUntil > new Date();
  const step = order.status === "AWAITING_PAYMENT" ? 0 : open ? 3 : 2;
  const codes = order.sessions.flatMap((s) => s.items.map((i) => i.clipCode));
  const wa = whatsappUrl(
    cfg.whatsapp,
    `Hi Ocean X! My order ${order.reference}: ${codes.length} clip${codes.length === 1 ? "" : "s"} (${codes.join(", ")}) — ${money(order.total)}, paying by ${order.paymentMethod === "BANK_TRANSFER" ? "bank transfer" : "cash"}. ${siteUrl()}/order/${token}`,
  );

  return (
    <section className="min-h-screen bg-abyss pb-24 pt-32 text-foam md:pt-40">
      <div className="container-x max-w-3xl">
        {isNew && (
          <p className="mb-8 rounded border border-gold/40 bg-gold/10 px-4 py-3 text-sm">
            Thank you, {order.name.split(" ")[0]}! Your order is in. <strong>Bookmark this page</strong> — it&apos;s your private link to follow it and download your clips.
          </p>
        )}
        <p className="eyebrow eyebrow-line text-gold">Order {order.reference}</p>
        <h1 className="display mt-4 text-4xl [font-stretch:112%] md:text-5xl">{open ? "Your clips are ready." : paid ? "Payment confirmed." : "Almost there."}</h1>

        <div className="mt-10">
          <Steps steps={["Waiting for payment", "Payment confirmed", "Ready to download"]} current={step} stopped={order.status === "CANCELLED" ? "This order was cancelled. Message us if that's a mistake." : undefined} />
        </div>

        {order.status === "AWAITING_PAYMENT" && (
          <div className="mt-10 space-y-5 border border-foam/10 bg-ink p-5">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-mist">To pay</span>
              <span className="display text-3xl text-gold">{money(order.total)}</span>
            </div>
            {order.paymentMethod === "BANK_TRANSFER" || order.paymentMethod === "GUIDE" ? (
              <>
                {order.paymentMethod === "GUIDE" && (
                  <p className="text-sm text-mist">Give the cash to your guide. They transfer it to the account below and upload the slip on this page.</p>
                )}
                <div className="rounded bg-abyss p-4 text-sm">
                  <p className="whitespace-pre-line font-mono text-foam/90">{cfg.bankDetails}</p>
                  <p className="mt-2 text-xs text-mist">Reference: {order.reference}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <CopyButton text={cfg.bankDetails} label="Copy bank details" className="rounded-full border border-gold/60 px-3 py-1.5 text-[10px] font-semibold tracking-[0.14em] text-gold" />
                    <CopyButton text={order.reference} label="Copy reference" className="rounded-full border border-foam/25 px-3 py-1.5 text-[10px] font-semibold tracking-[0.14em]" />
                  </div>
                </div>
                <SlipUpload token={token} count={order._count.slips} />
                {order.paymentMethod === "GUIDE" && (
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`Hi! Here's my Ocean X payment page: ${siteUrl()}/order/${token}. Please transfer ${money(order.total)} to the account shown and upload the slip there. Thank you!`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-full bg-[#25D366] py-3 text-center text-[12px] font-semibold tracking-[0.14em] text-abyss"
                  >
                    SEND THIS PAGE TO MY GUIDE
                  </a>
                )}
              </>
            ) : (
              <p className="text-sm text-mist">{cfg.cashText}</p>
            )}
          </div>
        )}

        {wa && (
          <a href={wa} target="_blank" rel="noopener noreferrer" className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] py-3.5 text-[12px] font-semibold tracking-[0.16em] text-abyss">
            SEND ON WHATSAPP
          </a>
        )}

        {paid && !open && order.downloadsUntil && (
          <p className="mt-8 rounded border border-foam/15 px-4 py-3 text-sm text-mist">
            Your download links expired on {formatDate(order.downloadsUntil)}. Message us and we&apos;ll reopen them.
          </p>
        )}
        {open && order.downloadsUntil && <p className="mt-8 text-sm text-mist">Download links work until {formatDate(order.downloadsUntil, { day: "numeric", month: "long" })}. Save your clips to your phone.</p>}

        <div className="mt-10 space-y-6">
          {order.sessions.map((s) => (
            <div key={s.id} className="border border-foam/10 p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-[11px] uppercase tracking-[0.18em] text-mist">
                  {s.location?.name ?? "Ocean X"} · {SLOT_LABEL[s.slot]} · {formatDate(s.date, { day: "numeric", month: "short" })}
                </h2>
                <span className="text-sm">
                  {ORDER_PACKAGE_LABEL[s.package]} · <span className="text-gold">{money(s.price)}</span>
                </span>
              </div>
              <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {s.items.map((i) => (
                  <li key={i.id}>
                    <span className="block aspect-[4/5] overflow-hidden bg-ink">
                      {i.clip?.posterUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={i.clip.posterUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                      )}
                    </span>
                    <span className="mt-1 block font-mono text-[11px] text-mist">{i.clipCode}</span>
                    {open && i.clip && (
                      <a href={`/api/download/${token}/${i.clip.id}`} className="mt-1.5 block rounded-full bg-gold py-2 text-center text-[11px] font-semibold tracking-[0.14em] text-abyss">
                        DOWNLOAD
                      </a>
                    )}
                  </li>
                ))}
              </ul>
              {s.package !== "CLIPS" && !open && <p className="mt-3 text-xs text-mist">We&apos;ll add every clip of you from this session{s.package === "SESSION_REEL" ? " and your edited reel" : ""} once your payment is confirmed.</p>}
            </div>
          ))}
          {open && order.files.length > 0 && (
            <div className="border border-gold/30 p-5">
              <h2 className="text-[11px] uppercase tracking-[0.18em] text-gold">Your edit</h2>
              <ul className="mt-3 space-y-2">
                {order.files.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-3 text-sm">
                    {f.name}
                    <a href={`/api/download/${token}/${f.id}`} className="rounded-full bg-gold px-4 py-2 text-[11px] font-semibold tracking-[0.14em] text-abyss">
                      DOWNLOAD
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        {open && <p className="mt-6 text-xs text-mist">On iPhone: tap Download, then the share button → Save Video. On Android: tap Download, then ⋮ → Download.</p>}
        <p className="mt-12 text-center text-sm">
          <Link href="/clips" className="text-gold underline">
            Find more clips
          </Link>
        </p>
      </div>
    </section>
  );
}
