"use client";

import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { addClipsToOrder } from "../actions";

export function AddClipsForm({ orderId, sessionId }: { orderId: string; sessionId: string }) {
  return (
    <ActionForm action={addClipsToOrder.bind(null, orderId, sessionId)} className="mt-3 flex flex-wrap items-end gap-2">
      <label className="flex-1 text-xs font-medium text-slate">
        Add their other clips (codes)
        <input name="codes" placeholder="MC-2710-03, MC-2710-09" className="mt-1 block w-full rounded-lg border border-slate/30 px-3 py-2 font-mono text-sm text-deep" />
      </label>
      <SubmitButton variant="secondary">Add</SubmitButton>
    </ActionForm>
  );
}
