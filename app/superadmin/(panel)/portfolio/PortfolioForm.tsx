import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { ImagePicker } from "@/components/admin/ImagePicker";
import { VideoField } from "@/components/admin/VideoField";
import { Card, Checkbox, Select, TextArea, TextField } from "@/components/admin/ui";
import { PORTFOLIO_CATEGORIES } from "@/lib/constants";
import { dateInputValue } from "@/lib/format";
import type { FormState } from "@/lib/forms";

type Values = {
  title: string;
  description: string;
  category: string;
  locationId: string | null;
  date: Date | null;
  videoUrl: string | null;
  displayOrder: number;
  featured: boolean;
  published: boolean;
  coverId: string | null;
  images: { mediaId: string }[];
};

export function PortfolioForm({ action, item, locations }: { action: (p: FormState, fd: FormData) => Promise<FormState>; item?: Values; locations: { id: string; name: string }[] }) {
  const w = item;
  return (
    <ActionForm action={action} className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <Card title="Details">
          <div className="space-y-5">
            <TextField label="Title" name="title" required defaultValue={w?.title} placeholder="e.g. Morning glass at Machines" />
            <TextArea label="Description" name="description" rows={6} defaultValue={w?.description} />
            <VideoField label="Video" name="videoUrl" defaultValue={w?.videoUrl} />
          </div>
        </Card>
        <Card title="Images">
          <div className="space-y-6">
            <ImagePicker name="coverId" label="Cover image" initial={w?.coverId ? [{ id: w.coverId }] : []} hint="Also used as the video thumbnail." />
            <ImagePicker name="imageIds" label="More images" multiple initial={w?.images.map((i) => ({ id: i.mediaId })) ?? []} />
          </div>
        </Card>
      </div>
      <div className="space-y-6">
        <Card title="Publishing">
          <div className="space-y-4">
            <Checkbox label="Published" name="published" defaultChecked={w?.published ?? true} hint="Visible on the website." />
            <Checkbox label="Featured" name="featured" defaultChecked={w?.featured ?? false} hint="Shown first on the home page." />
            <TextField label="Display order" name="displayOrder" type="number" defaultValue={w?.displayOrder ?? 0} />
          </div>
        </Card>
        <Card title="Organise">
          <div className="space-y-4">
            <Select label="Category" name="category" required defaultValue={w?.category ?? "Surf"} options={PORTFOLIO_CATEGORIES.map((c) => ({ value: c, label: c }))} />
            <Select label="Location" name="locationId" defaultValue={w?.locationId ?? ""} options={[{ value: "", label: "— None —" }, ...locations.map((l) => ({ value: l.id, label: l.name }))]} hint="Add places under Locations." />
            <TextField label="Date" name="date" type="date" defaultValue={dateInputValue(w?.date)} />
          </div>
        </Card>
        <SubmitButton className="w-full">{w ? "Save changes" : "Add to portfolio"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
