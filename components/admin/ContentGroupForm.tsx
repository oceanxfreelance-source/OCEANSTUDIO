import { saveContent } from "@/app/superadmin/(panel)/content/actions";
import { CONTENT_FIELDS, type Content } from "@/lib/content";
import { ActionForm, SubmitButton } from "./ActionForm";
import { ImagePicker } from "./ImagePicker";
import { Card, TextArea, TextField } from "./ui";
import { VideoField } from "./VideoField";

/** One saveable group of website settings (used on Website content and Prices). */
export function ContentGroupForm({ group, c, title, saveLabel }: { group: string; c: Content; title?: string; saveLabel?: string }) {
  return (
    <ActionForm action={saveContent.bind(null, group)}>
      <Card title={title ?? group}>
        <div className="space-y-5">
          {CONTENT_FIELDS.filter((f) => f.group === group).map((f) => {
            const type = "type" in f ? f.type : "text";
            const help = "help" in f ? f.help : undefined;
            const value = c[f.key];
            if (f.key === "hero.videoUrl") return <VideoField key={f.key} name={f.key} label={f.label} defaultValue={value} hint="A short, silent drone clip (10–30 s, 1080p) plays behind the home page title." />;
            if (type === "image") return <ImagePicker key={f.key} name={f.key} label={f.label} hint={help} initial={value ? [{ id: value }] : []} />;
            if (type === "textarea") return <TextArea key={f.key} name={f.key} label={f.label} hint={help} defaultValue={value} rows={value.length > 300 ? 8 : 4} />;
            if (type === "number") return <TextField key={f.key} name={f.key} label={f.label} hint={help} defaultValue={value} inputMode="decimal" />;
            return <TextField key={f.key} name={f.key} label={f.label} hint={help} defaultValue={value} type={type === "url" ? "url" : "text"} />;
          })}
          <SubmitButton>{saveLabel ?? `Save ${group.toLowerCase()}`}</SubmitButton>
        </div>
      </Card>
    </ActionForm>
  );
}
