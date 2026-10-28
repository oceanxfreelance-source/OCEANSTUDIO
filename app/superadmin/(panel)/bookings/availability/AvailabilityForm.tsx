"use client";

import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { SLOT_LABEL, SLOTS, type Slot } from "@/lib/shop-rules";
import { saveAvailability } from "../actions";

type Day = { date: string; label: string; slots: Record<Slot, { max: number | null; closed: boolean; booked: number }> };

export function AvailabilityForm({ days, defaultMax }: { days: Day[]; defaultMax: number }) {
  return (
    <ActionForm action={saveAvailability} className="space-y-4">
      <p className="text-sm text-slate">Leave a box empty to use the default ({defaultMax} per session). Tick “Closed” for days you can&apos;t film.</p>
      <div className="overflow-x-auto rounded-xl border border-slate/15 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate/10 text-left text-xs uppercase tracking-wider text-slate">
              <th className="p-3">Day</th>
              {SLOTS.map((s) => (
                <th key={s} className="p-3">
                  {SLOT_LABEL[s]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.date} className="border-b border-slate/5 last:border-0">
                <td className="whitespace-nowrap p-3 font-medium">{d.label}</td>
                {SLOTS.map((s) => (
                  <td key={s} className="p-3">
                    <div className="flex items-center gap-2">
                      <input
                        name={`max:${d.date}:${s}`}
                        type="number"
                        min={0}
                        max={50}
                        defaultValue={d.slots[s].max ?? ""}
                        placeholder={String(defaultMax)}
                        aria-label={`${d.label} ${SLOT_LABEL[s]} max bookings`}
                        className="w-14 rounded border border-slate/30 px-2 py-1"
                      />
                      <label className="flex items-center gap-1 text-xs text-slate">
                        <input type="checkbox" name={`closed:${d.date}:${s}`} defaultChecked={d.slots[s].closed} /> Closed
                      </label>
                      {d.slots[s].booked > 0 && <span className="text-xs font-semibold text-violet-700">{d.slots[s].booked} booked</span>}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SubmitButton>Save availability</SubmitButton>
    </ActionForm>
  );
}
