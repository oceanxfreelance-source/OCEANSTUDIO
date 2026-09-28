"use client";

import { useEffect, useState } from "react";

const FMT: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" };

/** Renders in the viewer's local time zone (server renders UTC first, then hydrates). */
export function LocalTime({ iso, relative }: { iso: string | Date | null | undefined; relative?: boolean }) {
  const [text, setText] = useState<string>(() => (iso ? new Date(iso).toLocaleString("en-GB", { ...FMT, timeZone: "UTC" }) + " UTC" : "—"));
  useEffect(() => {
    if (!iso) return;
    const d = new Date(iso);
    if (!relative) return setText(d.toLocaleString("en-GB", FMT));
    const update = () => {
      const diff = d.getTime() - Date.now();
      const abs = Math.abs(diff);
      const h = Math.floor(abs / 3600_000);
      const m = Math.floor((abs % 3600_000) / 60_000);
      const span = h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${m}m`;
      setText(diff >= 0 ? `in ${span}` : `${span} ago`);
    };
    update();
    const t = setInterval(update, 30_000);
    return () => clearInterval(t);
  }, [iso, relative]);
  return (
    <time dateTime={iso ? new Date(iso).toISOString() : undefined} suppressHydrationWarning>
      {text}
    </time>
  );
}
