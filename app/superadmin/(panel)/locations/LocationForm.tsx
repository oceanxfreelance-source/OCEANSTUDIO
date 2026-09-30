import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { ImagePicker } from "@/components/admin/ImagePicker";
import { Card, Checkbox, Select, TextArea, TextField } from "@/components/admin/ui";
import { LOCATION_KINDS } from "@/lib/constants";
import type { FormState } from "@/lib/forms";

type Values = {
  name: string;
  kind: string;
  atoll: string;
  description: string;
  videoUrl: string | null;
  displayOrder: number;
  featured: boolean;
  published: boolean;
  coverId: string | null;
  images: { mediaId: string }[];
};

export function LocationForm({ action, location }: { action: (p: FormState, fd: FormData) => Promise<FormState>; location?: Values }) {
  const l = location;
  return (
    <ActionForm action={action} className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <Card title="Details">
          <div className="space-y-5">
            <TextField label="Name" name="name" required defaultValue={l?.name} placeholder="e.g. Machines" />
            <TextArea label="Description" name="description" rows={6} defaultValue={l?.description} />
            <TextField label="Video link" name="videoUrl" type="url" defaultValue={l?.videoUrl ?? ""} placeholder="https://youtube.com/…" />
          </div>
        </Card>
        <Card title="Images">
          <div className="space-y-6">
            <ImagePicker name="coverId" label="Cover image" initial={l?.coverId ? [{ id: l.coverId }] : []} />
            <ImagePicker name="imageIds" label="Gallery" multiple initial={l?.images.map((i) => ({ id: i.mediaId })) ?? []} />
          </div>
        </Card>
      </div>
      <div className="space-y-6">
        <Card title="Publishing">
          <div className="space-y-4">
            <Checkbox label="Published" name="published" defaultChecked={l?.published ?? true} />
            <Checkbox label="Featured" name="featured" defaultChecked={l?.featured ?? false} hint="Shown first on the Laamu page." />
            <TextField label="Display order" name="displayOrder" type="number" defaultValue={l?.displayOrder ?? 0} />
          </div>
        </Card>
        <Card title="Type & area">
          <div className="space-y-4">
            <Select label="Type" name="kind" defaultValue={l?.kind ?? "Island"} options={LOCATION_KINDS.map((k) => ({ value: k, label: k }))} />
            <TextField label="Atoll" name="atoll" defaultValue={l?.atoll ?? "Laamu"} hint="Ready for locations beyond Laamu later." />
          </div>
        </Card>
        <SubmitButton className="w-full">{l ? "Save changes" : "Add location"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
