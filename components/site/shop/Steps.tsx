import { cx } from "@/components/ui/cx";

/** Progress line for orders and bookings: done ✓, current, upcoming. */
export function Steps({ steps, current, stopped }: { steps: string[]; current: number; stopped?: string }) {
  if (stopped) return <p className="rounded border border-foam/15 px-4 py-3 text-sm text-mist">{stopped}</p>;
  return (
    <ol className="grid gap-2" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
      {steps.map((s, i) => (
        <li key={s} className="text-center">
          <span className={cx("mx-auto flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold", i < current ? "border-gold bg-gold text-abyss" : i === current ? "border-gold text-gold" : "border-foam/20 text-foam/40")}>
            {i < current ? "✓" : i + 1}
          </span>
          <span className={cx("mt-2 block text-[11px] leading-tight", i <= current ? "text-foam" : "text-foam/40")}>{s}</span>
        </li>
      ))}
    </ol>
  );
}
