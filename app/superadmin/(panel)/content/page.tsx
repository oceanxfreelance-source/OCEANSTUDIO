import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { ImagePicker } from "@/components/admin/ImagePicker";
import { Card, PageHeader, TextArea, TextField } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { CONTENT_FIELDS, getContent } from "@/lib/content";
import { saveContent } from "./actions";

export const metadata = { title: "Website content" };

export default async function ContentAdmin() {
  await requireAdmin();
  const c = await getContent();
  const groups = [...new Set(CONTENT_FIELDS.map((f) => f.group))];

  return (
    <>
      <PageHeader title="Website content" subtitle="Edit the text and images on the public website. Each section saves separately." />
      <div className="mb-6 flex flex-wrap gap-2">
        {groups.map((g) => (
          <a key={g} href={`#${encodeURIComponent(g)}`} className="rounded-full border border-slate/25 bg-white px-3 py-1 text-xs hover:bg-foam">
            {g}
          </a>
        ))}
      </div>
      <div className="space-y-6">
        {groups.map((g) => (
          <div key={g} id={encodeURIComponent(g)} className="scroll-mt-20">
            <ActionForm action={saveContent.bind(null, g)}>
              <Card title={g}>
                <div className="space-y-5">
                  {CONTENT_FIELDS.filter((f) => f.group === g).map((f) => {
                    const type = "type" in f ? f.type : "text";
                    const help = "help" in f ? f.help : undefined;
                    const value = c[f.key];
                    if (type === "image") return <ImagePicker key={f.key} name={f.key} label={f.label} hint={help} initial={value ? [{ id: value }] : []} />;
                    if (type === "textarea") return <TextArea key={f.key} name={f.key} label={f.label} hint={help} defaultValue={value} rows={value.length > 300 ? 8 : 4} />;
                    return <TextField key={f.key} name={f.key} label={f.label} hint={help} defaultValue={value} type={type === "url" ? "url" : "text"} />;
                  })}
                  <SubmitButton>Save {g.toLowerCase()}</SubmitButton>
                </div>
              </Card>
            </ActionForm>
          </div>
        ))}
      </div>
    </>
  );
}
