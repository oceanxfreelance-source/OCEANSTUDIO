import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { ImagePicker } from "@/components/admin/ImagePicker";
import { Card, Checkbox, Select, TextArea, TextField } from "@/components/admin/ui";
import { dateInputValue } from "@/lib/format";
import type { FormState } from "@/lib/forms";

type Values = { name: string; instagram: string | null; text: string; rating: number | null; date: Date | null; avatarId: string | null; featured: boolean; published: boolean };

export function TestimonialForm({ action, t }: { action: (p: FormState, fd: FormData) => Promise<FormState>; t?: Values }) {
  return (
    <ActionForm action={action} className="max-w-2xl">
      <Card>
        <div className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField label="Customer name" name="name" required defaultValue={t?.name} />
            <TextField label="Instagram username" name="instagram" defaultValue={t?.instagram ?? ""} placeholder="without @" />
          </div>
          <TextArea label="Review" name="text" required rows={5} defaultValue={t?.text} hint="Only publish real words from real customers, with their permission." />
          <div className="grid gap-5 sm:grid-cols-2">
            <Select
              label="Stars"
              name="rating"
              defaultValue={t?.rating?.toString() ?? "5"}
              options={[{ value: "", label: "No stars" }, ...[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${"★".repeat(n)} (${n})` }))]}
            />
            <TextField label="Date" name="date" type="date" defaultValue={dateInputValue(t?.date)} />
          </div>
          <ImagePicker name="avatarId" label="Profile image (optional)" initial={t?.avatarId ? [{ id: t.avatarId }] : []} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Checkbox label="Show on website" name="published" defaultChecked={t?.published ?? true} />
            <Checkbox label="Featured" name="featured" defaultChecked={t?.featured ?? false} hint="Shown on the home page." />
          </div>
          <SubmitButton>{t ? "Save changes" : "Add review"}</SubmitButton>
        </div>
      </Card>
    </ActionForm>
  );
}
