import { MediaPicker } from "@/components/admin/MediaPicker";
import { MediaWorkspace } from "@/components/admin/MediaWorkspace";
import { Alert, PageHeader } from "@/components/ui";
import { capabilities } from "@/server/capabilities";
import { mediaDetail } from "@/server/media-detail";
import { pickerItems, projectOptions } from "@/server/picker";

export const metadata = { title: "AI Video" };

export default async function Page({ searchParams }: { searchParams: Promise<{ media?: string; project?: string }> }) {
  const { media: mediaId, project } = await searchParams;
  const [items, projects] = await Promise.all([pickerItems(["VIDEO"], project), projectOptions()]);
  const selected = mediaId ? await mediaDetail(mediaId).catch(() => null) : null;
  const valid = selected && (["VIDEO"] as string[]).includes(selected.mediaType);
  return (
    <>
      <PageHeader eyebrow="Enhance · Stabilize · Grade" title="AI Video" />
      <MediaPicker items={items} selectedId={mediaId} basePath="/admin/video-ai" projects={projects} projectId={project} />
      <div className="mt-6">
        {valid ? <MediaWorkspace media={selected} caps={capabilities()} initialTab="video" /> : <Alert>Select a file above to open the workspace. Every result is saved as a new version; masters are never modified.</Alert>}
      </div>
    </>
  );
}
