import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { ImagePicker } from "@/components/admin/ImagePicker";
import { Card, Checkbox, options, Select, TextArea, TextField } from "@/components/admin/ui";
import { PRICE_TYPE_LABEL, SERVICE_STATUS_LABEL } from "@/lib/constants";
import type { FormState } from "@/lib/forms";

type ServiceValues = {
  name: string;
  shortDescription: string;
  description: string;
  status: string;
  price: { toString(): string } | null;
  priceType: string;
  currency: string;
  displayOrder: number;
  featured: boolean;
  published: boolean;
  coverId: string | null;
  images: { mediaId: string }[];
};

export function ServiceForm({ action, service }: { action: (prev: FormState, fd: FormData) => Promise<FormState>; service?: ServiceValues }) {
  const s = service;
  return (
    <ActionForm action={action} className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <Card title="Details">
          <div className="space-y-5">
            <TextField label="Service name" name="name" required defaultValue={s?.name} placeholder="e.g. Drone Videography" />
            <TextField label="Short description" name="shortDescription" defaultValue={s?.shortDescription} hint="One line shown on cards." maxLength={300} />
            <TextArea label="Full description" name="description" rows={8} defaultValue={s?.description} hint="Shown on the service page. Leave a blank line between paragraphs." />
          </div>
        </Card>
        <Card title="Images">
          <div className="space-y-6">
            <ImagePicker name="coverId" label="Cover image" initial={s?.coverId ? [{ id: s.coverId }] : []} />
            <ImagePicker name="imageIds" label="Gallery" multiple initial={s?.images.map((i) => ({ id: i.mediaId })) ?? []} />
          </div>
        </Card>
      </div>
      <div className="space-y-6">
        <Card title="Status & visibility">
          <div className="space-y-4">
            <Select label="Status" name="status" defaultValue={s?.status ?? "COMING_SOON"} options={options(SERVICE_STATUS_LABEL)} hint="Active = bookable. Coming soon = shown with a badge. Hidden = not on the website." />
            <Checkbox label="Published" name="published" defaultChecked={s?.published ?? true} hint="Untick to keep as a draft." />
            <Checkbox label="Featured" name="featured" defaultChecked={s?.featured ?? false} />
            <TextField label="Display order" name="displayOrder" type="number" defaultValue={s?.displayOrder ?? 0} hint="Lower numbers show first." />
          </div>
        </Card>
        <Card title="Price">
          <div className="space-y-4">
            <Select label="Price type" name="priceType" defaultValue={s?.priceType ?? "ON_REQUEST"} options={options(PRICE_TYPE_LABEL)} />
            <div className="grid grid-cols-[1fr_90px] gap-3">
              <TextField label="Price" name="price" inputMode="decimal" defaultValue={s?.price?.toString() ?? ""} placeholder="150" />
              <TextField label="Currency" name="currency" defaultValue={s?.currency ?? "USD"} maxLength={3} />
            </div>
          </div>
        </Card>
        <SubmitButton className="w-full">{s ? "Save changes" : "Create service"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
