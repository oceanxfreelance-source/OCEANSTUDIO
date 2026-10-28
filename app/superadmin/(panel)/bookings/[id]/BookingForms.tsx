"use client";

import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { SLOT_LABEL, SLOTS } from "@/lib/shop-rules";
import { moveBooking, saveBookingNotes } from "../actions";

export function MoveForm({ id, date, slot }: { id: string; date: string; slot: string }) {
  return (
    <ActionForm action={moveBooking.bind(null, id)} className="space-y-3" successMessage="Moved.">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium">
          New date
          <input type="date" name="date" defaultValue={date} required className="mt-1 block w-full rounded-lg border border-slate/30 px-3 py-2 text-sm" />
        </label>
        <label className="text-sm font-medium">
          Session
          <select name="slot" defaultValue={slot} className="mt-1 block w-full rounded-lg border border-slate/30 bg-white px-3 py-2 text-sm">
            {SLOTS.map((s) => (
              <option key={s} value={s}>
                {SLOT_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-sm font-medium">
        Message to the surfer <span className="font-normal text-slate">(optional)</span>
        <input name="note" maxLength={300} placeholder="e.g. Wind is better in the morning." className="mt-1 block w-full rounded-lg border border-slate/30 px-3 py-2 text-sm" />
      </label>
      <label className="flex items-center gap-2 text-xs text-slate">
        <input type="checkbox" name="force" /> Move anyway if that session is full
      </label>
      <SubmitButton variant="secondary">Move booking</SubmitButton>
    </ActionForm>
  );
}

export function NotesForm({ id, notes }: { id: string; notes: string }) {
  return (
    <ActionForm action={saveBookingNotes.bind(null, id)} className="space-y-3">
      <textarea name="notes" defaultValue={notes} rows={4} maxLength={5000} aria-label="Private notes" className="block w-full rounded-lg border border-slate/30 px-3 py-2 text-sm" />
      <SubmitButton variant="secondary">Save notes</SubmitButton>
    </ActionForm>
  );
}
