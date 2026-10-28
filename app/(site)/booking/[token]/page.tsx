import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/site/shop/CopyButton";
import { SlipUpload } from "@/components/site/shop/SlipUpload";
import { Steps } from "@/components/site/shop/Steps";
import { BOOKING_STATUS_LABEL } from "@/lib/bookings";
import { db } from "@/lib/db";
import { formatDate, money, toNumber, whatsappUrl } from "@/lib/format";
import { getShopConfig } from "@/lib/shop";
import { BOOKING_PACKAGE_LABEL, SLOT_LABEL } from "@/lib/shop-rules";
import { siteUrl } from "@/lib/site";
import { isToken } from "@/lib/tokens";

export const metadata: Metadata = { title: "Your booking", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const STEP: Record<string, number> = { NEW: 0, CONTACTED: 0, CONFIRMED: 1, FILMED: 2, READY: 3, COMPLETED: 4 };

export default async function BookingPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ new?: string }> }) {
  const { token } = await params;
  if (!isToken(token)) notFound();
  const [b, cfg] = await Promise.all([
    db.booking.findUnique({
      where: { token },
      include: {
        clips: { where: { status: "READY" }, orderBy: { code: "asc" }, select: { id: true, code: true, posterUrl: true, previewUrl: true } },
        files: { select: { id: true, name: true } },
        _count: { select: { slips: true } },
      },
    }),
    getShopConfig(),
  ]);
  if (!b) notFound();
  const { new: isNew } = await searchParams;

  const price = toNumber(b.price) ?? 0;
  const deposit = toNumber(b.deposit) ?? 0;
  const paidAll = b.paymentStatus === "PAID";
  const due = paidAll ? 0 : b.paymentStatus === "DEPOSIT" ? price - deposit : deposit > 0 ? deposit : price;
  const ready = b.status === "READY" || b.status === "COMPLETED";
  const open = ready && paidAll && !!b.downloadsUntil && b.downloadsUntil > new Date();
  const stopped = b.status === "DECLINED" ? "Sorry — we couldn't take this booking. Message us and we'll find another time." : b.status === "CANCELLED" ? "This booking was cancelled." : undefined;
  const when = `${b.preferredDate ? formatDate(b.preferredDate, { weekday: "long", day: "numeric", month: "long" }) : "—"} · ${b.slot ? `${SLOT_LABEL[b.slot]} (${cfg.slotTimes[b.slot]})` : ""}`;
  const wa = whatsappUrl(cfg.whatsapp, `Hi Ocean X! Booking ${b.reference} — ${when}, ${b.people ?? 1} surfer(s), ${b.package ? BOOKING_PACKAGE_LABEL[b.package] : ""}. ${siteUrl()}/booking/${token}`);

  return (
    <section className="min-h-screen bg-abyss pb-24 pt-32 text-foam md:pt-40">
      <div className="container-x max-w-3xl">
        {isNew && (
          <p className="mb-8 rounded border border-gold/40 bg-gold/10 px-4 py-3 text-sm">
            Thank you, {b.fullName.split(" ")[0]}! We&apos;ve got your request and will confirm on WhatsApp. <strong>Bookmark this page</strong> — your clips will appear here.
          </p>
        )}
        <p className="eyebrow eyebrow-line text-gold">Booking {b.reference}</p>
        <h1 className="display mt-4 text-4xl [font-stretch:112%] md:text-5xl">{open ? "Your clips are ready." : BOOKING_STATUS_LABEL[b.status]}</h1>

        <div className="mt-10">
          <Steps steps={["Requested", "Confirmed", "Filmed", "Ready to download"]} current={open ? 4 : (STEP[b.status] ?? 0)} stopped={stopped} />
        </div>

        {b.changeNote && <p className="mt-8 rounded border border-gold/50 bg-gold/10 px-4 py-3 text-sm">📣 {b.changeNote}</p>}

        <dl className="mt-8 grid gap-4 border border-foam/10 p-5 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-[0.16em] text-mist">When</dt>
            <dd className="mt-1">{when}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.16em] text-mist">Where</dt>
            <dd className="mt-1">{b.locationText || "Machines"}, Maabaidhoo</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.16em] text-mist">Package</dt>
            <dd className="mt-1">
              {b.package ? BOOKING_PACKAGE_LABEL[b.package] : b.serviceName} · {b.people ?? 1} surfer{(b.people ?? 1) === 1 ? "" : "s"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.16em] text-mist">How we spot you</dt>
            <dd className="mt-1">{b.recognition || "—"}</dd>
          </div>
        </dl>

        {!stopped && (
          <div className="mt-6 space-y-4 border border-foam/10 bg-ink p-5">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-mist">Total</span>
              <span>{money(price)}</span>
            </div>
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-mist">Paid</span>
              <span>{paidAll ? "All paid ✓" : b.paymentStatus === "DEPOSIT" ? `Deposit ${money(deposit)} ✓` : "Nothing yet"}</span>
            </div>
            {due > 0 && (
              <>
                <div className="flex items-baseline justify-between border-t border-foam/10 pt-4">
                  <span className="text-sm">{b.paymentStatus === "DEPOSIT" ? "Balance due when your clips are ready" : "Deposit to pay now"}</span>
                  <span className="display text-3xl text-gold">{money(due)}</span>
                </div>
                {(b.paymentMethod === "BANK_TRANSFER" || b.paymentMethod === "GUIDE") && cfg.bankDetails ? (
                  <>
                    {b.paymentMethod === "GUIDE" && (
                      <p className="text-sm text-mist">Give the cash to your guide. They transfer it to the account below and upload the slip on this page.</p>
                    )}
                    <div className="rounded bg-abyss p-4 text-sm">
                      <p className="whitespace-pre-line font-mono">{cfg.bankDetails}</p>
                      <p className="mt-2 text-xs text-mist">Reference: {b.reference}</p>
                      <div className="mt-3">
                        <CopyButton text={cfg.bankDetails} label="Copy bank details" className="rounded-full border border-gold/60 px-3 py-1.5 text-[10px] font-semibold tracking-[0.14em] text-gold" />
                      </div>
                    </div>
                    <SlipUpload token={token} count={b._count.slips} />
                    {b.paymentMethod === "GUIDE" && (
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`Hi! Here's my Ocean X payment page: ${siteUrl()}/booking/${token}. Please transfer ${money(due)} to the account shown and upload the slip there. Thank you!`)}`}
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
              </>
            )}
          </div>
        )}

        {wa && (
          <a href={wa} target="_blank" rel="noopener noreferrer" className="mt-5 flex w-full items-center justify-center rounded-full bg-[#25D366] py-3.5 text-[12px] font-semibold tracking-[0.16em] text-abyss">
            SEND ON WHATSAPP
          </a>
        )}

        {ready && b.clips.length > 0 && (
          <div className="mt-10">
            <h2 className="eyebrow text-gold">Your clips ({b.clips.length})</h2>
            {!paidAll && <p className="mt-2 text-sm text-mist">Here are your previews. Downloads of the full-quality clips open as soon as the balance is paid.</p>}
            {paidAll && !open && b.downloadsUntil && <p className="mt-2 text-sm text-mist">Download links expired on {formatDate(b.downloadsUntil)} — message us to reopen them.</p>}
            {open && b.downloadsUntil && <p className="mt-2 text-sm text-mist">Download links work until {formatDate(b.downloadsUntil, { day: "numeric", month: "long" })}.</p>}
            <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {b.clips.map((c) => (
                <li key={c.id}>
                  <span className="block aspect-[4/5] overflow-hidden bg-ink">
                    {c.previewUrl ? (
                      <video src={c.previewUrl} poster={c.posterUrl ?? undefined} muted playsInline controls preload="none" className="h-full w-full object-cover" />
                    ) : null}
                  </span>
                  <span className="mt-1 block font-mono text-[11px] text-mist">{c.code}</span>
                  {open && (
                    <a href={`/api/download/${token}/${c.id}`} className="mt-1.5 block rounded-full bg-gold py-2 text-center text-[11px] font-semibold tracking-[0.14em] text-abyss">
                      DOWNLOAD
                    </a>
                  )}
                </li>
              ))}
            </ul>
            {open && b.files.length > 0 && (
              <ul className="mt-6 space-y-2">
                {b.files.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-3 border border-gold/30 p-3 text-sm">
                    {f.name}
                    <a href={`/api/download/${token}/${f.id}`} className="rounded-full bg-gold px-4 py-2 text-[11px] font-semibold tracking-[0.14em] text-abyss">
                      DOWNLOAD
                    </a>
                  </li>
                ))}
              </ul>
            )}
            {open && <p className="mt-6 text-xs text-mist">On iPhone: tap Download, then the share button → Save Video. On Android: tap Download, then ⋮ → Download.</p>}
          </div>
        )}
      </div>
    </section>
  );
}
