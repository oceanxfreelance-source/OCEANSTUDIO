/**
 * Slow, endless band of text between sections. The list is rendered twice so
 * the loop is seamless; screen readers get it once.
 */
export function Marquee({ items }: { items: string[] }) {
  const row = (hidden: boolean) => (
    <div className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {items.map((t, i) => (
        <span key={i} className="flex items-center">
          <span className={i % 2 ? "text-outline" : "text-foam"}>{t}</span>
          <span className="mx-8 inline-block h-2 w-2 rounded-full bg-gold md:mx-12" aria-hidden />
        </span>
      ))}
    </div>
  );
  return (
    <div className="marquee overflow-hidden border-y border-white/5 bg-abyss py-6 md:py-8">
      <div className="marquee-track display flex w-max text-4xl uppercase [font-stretch:120%] md:text-6xl">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}
