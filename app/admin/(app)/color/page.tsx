import { BatchColor } from "@/components/admin/BatchColor";
import { Alert, PageHeader, Select } from "@/components/ui";
import { db } from "@/lib/db";
import { projectOptions } from "@/server/picker";
import { versionView } from "@/server/views";

export const metadata = { title: "Color Grade" };

export default async function ColorPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const { project } = await searchParams;
  const projects = await projectOptions();
  const projectId = project ?? projects[0]?.id;
  const media = projectId
    ? await db.mediaFile.findMany({
        where: { projectId, status: "READY", mediaType: { in: ["PHOTO", "RAW"] } },
        orderBy: [{ capturedAt: "asc" }, { filename: "asc" }],
        include: { versions: { orderBy: { versionNumber: "asc" } } },
      })
    : [];
  const items = await Promise.all(
    media.map(async (m) => ({
      mediaId: m.id,
      filename: m.filename,
      versions: await Promise.all(
        m.versions.map(async (v) => {
          const view = await versionView(v, m.mediaType);
          return { id: v.id, label: v.label, versionNumber: v.versionNumber, thumbUrl: view.thumbUrl, isAi: v.isAi };
        }),
      ),
    })),
  );
  return (
    <>
      <PageHeader eyebrow="Presets · Batch" title="Color Grade">
        <form action="/admin/color" className="flex gap-2">
          <Select name="project" defaultValue={projectId} aria-label="Project" className="w-64">
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <button type="submit" className="h-9 rounded-lg border border-ink-600 px-3 text-xs">
            Open
          </button>
        </form>
      </PageHeader>
      {projectId ? <BatchColor items={items.filter((i) => i.versions.length > 0)} /> : <Alert>Create a project first.</Alert>}
    </>
  );
}
