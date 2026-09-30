import Link from "next/link";
import { SERVICE_STATUS_LABEL } from "@/lib/constants";
import { formatDate, priceLabel } from "@/lib/format";
import type { MediaRef } from "@/lib/public";
import { cx } from "@/components/ui/cx";
import { ArrowRight, Pin } from "./Icons";
import { Img } from "./Img";

/** Placeholder shown when an item has no cover image yet: deep water + faint swell lines. */
export function CoverFallback({ label }: { label: string }) {
  return (
    <div className="relative flex h-full w-full items-end overflow-hidden bg-[radial-gradient(90%_70%_at_20%_10%,#26303f_0%,#13151a_55%,#07080a_100%)] p-5 text-foam/45">
      <svg aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 w-full opacity-30" viewBox="0 0 400 200" preserveAspectRatio="none">
        {Array.from({ length: 7 }, (_, i) => (
          <path key={i} d={`M0 ${40 + i * 22} C 100 ${30 + i * 22}, 200 ${52 + i * 22}, 400 ${38 + i * 22}`} fill="none" stroke="#e6d7b9" strokeWidth="0.7" opacity={0.25 + i * 0.1} />
        ))}
      </svg>
      <span className="eyebrow relative">{label}</span>
    </div>
  );
}

type ServiceCardData = {
  slug: string;
  name: string;
  shortDescription: string;
  status: "ACTIVE" | "COMING_SOON" | "HIDDEN";
  price: { toString(): string } | null;
  priceType: "ON_REQUEST" | "FIXED" | "FROM" | "PER_PERSON" | "PER_HOUR" | "PER_SESSION";
  currency: string;
  cover: MediaRef | null;
};

export function ServiceCard({ s, index }: { s: ServiceCardData; index?: number }) {
  const soon = s.status === "COMING_SOON";
  return (
    <Link href={`/services/${s.slug}`} data-reveal className="group flex flex-col">
      <div className="relative aspect-[4/3] overflow-hidden bg-ink sm:aspect-[4/5]">
        <div data-reveal-image className="absolute inset-0">
          <div className="h-full w-full">
            {s.cover ? (
              <Img media={s.cover} alt={s.name} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className={cx("transition duration-[1.2s] ease-out group-hover:scale-[1.06]", soon && "grayscale-[35%]")} />
            ) : (
              <CoverFallback label={s.name} />
            )}
          </div>
        </div>
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
          {index !== undefined && <span className="eyebrow text-foam/70">{String(index + 1).padStart(2, "0")}</span>}
          <span
            className={cx(
              "eyebrow rounded-full px-3 py-1.5 backdrop-blur",
              soon ? "bg-abyss/60 text-foam/80" : "bg-gold/90 text-abyss",
            )}
          >
            {SERVICE_STATUS_LABEL[s.status]}
          </span>
        </div>
      </div>
      <div className="mt-5 flex items-start justify-between gap-4">
        <div>
          <h3 className="display text-2xl transition-colors duration-300 [font-stretch:110%] group-hover:text-gold-deep">{s.name}</h3>
          {s.shortDescription && <p className="mt-2 text-sm leading-relaxed text-slate">{s.shortDescription}</p>}
          {!soon && <p className="mt-3 text-sm font-medium">{priceLabel(s.price, s.priceType, s.currency)}</p>}
        </div>
        <ArrowRight className="mt-1 h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1" />
      </div>
    </Link>
  );
}

type WorkCardData = {
  slug: string;
  title: string;
  category: string;
  date: Date | null;
  cover: MediaRef | null;
  videoUrl: string | null;
  location: { name: string } | null;
};

export function WorkCard({ w, large = false, dark = false }: { w: WorkCardData; large?: boolean; dark?: boolean }) {
  return (
    <Link href={`/work/${w.slug}`} data-reveal className="group block">
      <div className={cx("relative overflow-hidden bg-ink", large ? "aspect-[4/3] md:aspect-[16/10]" : "aspect-[4/5]")}>
        <div data-reveal-image className="absolute inset-0">
          <div className="h-full w-full">
            {w.cover ? (
              <Img media={w.cover} alt={w.title} sizes={large ? "(min-width: 768px) 66vw, 100vw" : "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"} className="transition duration-[1.2s] ease-out group-hover:scale-[1.06]" />
            ) : w.videoUrl && /\.(mp4|mov|m4v|webm)(\?|$)/i.test(w.videoUrl) ? (
              // No cover photo: show the uploaded video's first frame.
              <video src={`${w.videoUrl}#t=0.1`} muted playsInline preload="metadata" aria-hidden className="h-full w-full object-cover" />
            ) : (
              <CoverFallback label={w.category} />
            )}
          </div>
        </div>
        <span className="view-pill absolute left-1/2 top-1/2 z-10 -ml-9 -mt-9 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-foam text-[11px] font-semibold tracking-[0.2em] text-abyss">
          {w.videoUrl ? "PLAY" : "VIEW"}
        </span>
        <div className="absolute inset-0 bg-gradient-to-t from-abyss/70 via-transparent to-transparent opacity-80" />
        {w.videoUrl && <span className="eyebrow absolute right-4 top-4 rounded-full bg-abyss/60 px-3 py-1.5 text-foam backdrop-blur">Film</span>}
        <div className="absolute inset-x-0 bottom-0 p-5 text-foam">
          <p className="eyebrow text-foam/70">
            {w.category}
            {w.location ? ` · ${w.location.name}` : ""}
          </p>
          <h3 className={cx("display mt-2 [font-stretch:110%]", large ? "text-3xl md:text-4xl" : "text-2xl")}>{w.title}</h3>
        </div>
      </div>
      {w.date && <p className={cx("mt-3 text-xs", dark ? "text-mist" : "text-slate")}>{formatDate(w.date, { month: "long", year: "numeric" })}</p>}
    </Link>
  );
}

type LocationCardData = { slug: string; name: string; kind: string; atoll: string; cover: MediaRef | null; description: string };

export function LocationCard({ l, wide = false }: { l: LocationCardData; wide?: boolean }) {
  return (
    <Link href={`/machines/${l.slug}`} data-reveal className="group block">
      <div className={cx("relative overflow-hidden bg-ink", wide ? "aspect-[4/5] sm:aspect-[4/3]" : "aspect-[3/4]")}>
        <div data-reveal-image className="absolute inset-0">
          <div className="h-full w-full">
            {l.cover ? <Img media={l.cover} alt={l.name} sizes="(min-width: 640px) 50vw, 100vw" className="transition duration-[1.2s] ease-out group-hover:scale-[1.06]" /> : <CoverFallback label={l.kind} />}
          </div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-abyss/80 via-abyss/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-5 text-foam">
          <p className="eyebrow flex items-center gap-1.5 text-foam/70">
            <Pin className="h-3.5 w-3.5" /> {l.kind}
          </p>
          <h3 className={cx("display mt-2 [font-stretch:110%]", wide ? "text-3xl md:text-5xl" : "text-2xl")}>{l.name}</h3>
        </div>
      </div>
    </Link>
  );
}
