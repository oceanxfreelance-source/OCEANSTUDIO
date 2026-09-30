import { cx } from "@/components/ui/cx";
import { AnimatedWords } from "./HeroTitle";

/** Standard section heading: small eyebrow + large title + optional intro. */
export function SectionHeading({
  eyebrow,
  title,
  intro,
  dark = false,
  className,
  action,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  dark?: boolean;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <div data-reveal className={cx("flex flex-col gap-6 md:flex-row md:items-end md:justify-between", className)}>
      <div className="max-w-3xl">
        <p className={cx("eyebrow eyebrow-line", dark ? "text-sea" : "text-sea-deep")}>{eyebrow}</p>
        <h2 className="display mt-4 text-4xl [font-stretch:112%] sm:text-5xl lg:text-6xl">{title}</h2>
        {intro && <p className={cx("mt-5 max-w-2xl text-base leading-relaxed md:text-lg", dark ? "text-mist" : "text-slate")}>{intro}</p>}
      </div>
      {action}
    </div>
  );
}

/** Top-of-page banner for inner pages (dark, compact). */
export function PageHero({ eyebrow, title, intro }: { eyebrow: string; title: string; intro?: string }) {
  return (
    <section className="relative overflow-hidden bg-abyss pb-14 pt-32 text-foam md:pb-20 md:pt-44">
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(50%_60%_at_20%_0%,rgba(47,127,134,0.35),transparent_70%)]" />
      <div className="container-x relative">
        <p className="hero-in eyebrow eyebrow-line text-sea" style={{ "--delay": "0.05s" } as React.CSSProperties}>
          {eyebrow}
        </p>
        <h1 className="display mt-5 max-w-5xl text-5xl [font-stretch:115%] sm:text-6xl lg:text-7xl">
          <AnimatedWords text={title} />
        </h1>
        {intro && (
          <p className="hero-in mt-6 max-w-2xl text-base leading-relaxed text-mist md:text-lg" style={{ "--delay": "0.6s" } as React.CSSProperties}>
            {intro}
          </p>
        )}
      </div>
    </section>
  );
}

/** Paragraphs from admin-edited text (blank line = new paragraph). */
export function Prose({ text, className }: { text: string; className?: string }) {
  const paras = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return (
    <div className={cx("space-y-5 leading-relaxed", className)}>
      {paras.map((p, i) => (
        <p key={i} className="whitespace-pre-line">
          {p}
        </p>
      ))}
    </div>
  );
}

export function EmptyState({ title, body, dark = false }: { title: string; body?: string; dark?: boolean }) {
  return (
    <div className={cx("border px-6 py-16 text-center", dark ? "border-white/10 text-mist" : "border-deep/10 text-slate")}>
      <p className={cx("display text-2xl [font-stretch:110%]", dark ? "text-foam" : "text-deep")}>{title}</p>
      {body && <p className="mx-auto mt-3 max-w-md text-sm">{body}</p>}
    </div>
  );
}
