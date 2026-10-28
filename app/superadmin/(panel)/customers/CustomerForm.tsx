import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { TextArea, TextField } from "@/components/admin/ui";
import type { FormState } from "@/lib/forms";

type Values = { name: string; instagram: string | null; email: string | null; whatsapp: string | null; country: string | null; notes: string };

export function CustomerForm({ action, c }: { action: (p: FormState, fd: FormData) => Promise<FormState>; c?: Values }) {
  return (
    <ActionForm action={action}>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField label="Name" name="name" required defaultValue={c?.name} />
        <TextField label="Instagram" name="instagram" defaultValue={c?.instagram ?? ""} placeholder="without @" />
        <TextField label="Email" name="email" type="email" defaultValue={c?.email ?? ""} />
        <TextField label="WhatsApp" name="whatsapp" defaultValue={c?.whatsapp ?? ""} placeholder="+960 …" />
        <TextField label="Country" name="country" defaultValue={c?.country ?? ""} />
      </div>
      <TextArea label="Notes" name="notes" rows={4} defaultValue={c?.notes ?? ""} className="mt-5" hint="Private. Surf level, preferences, anything useful." />
      <SubmitButton className="mt-5">{c ? "Save customer" : "Add customer"}</SubmitButton>
    </ActionForm>
  );
}
