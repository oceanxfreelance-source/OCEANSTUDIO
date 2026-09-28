import Link from "next/link";
import { notFound } from "next/navigation";
import { MediaWorkspace } from "@/components/admin/MediaWorkspace";
import { PageHeader, StatusBadge } from "@/components/ui";
import { AppError } from "@/lib/errors";
import { capabilities } from "@/server/capabilities";
import { mediaDetail } from "@/server/media-detail";

export default async function MediaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tool?: string }> }) {
  const { id } = await params;
  const { tool } = await searchParams;
  const media = await mediaDetail(id).catch((e) => {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  });
  return (
    <>
      <PageHeader eyebrow={media.mediaType === "RAW" ? "RAW master" : media.mediaType === "VIDEO" ? "Video master" : "Photo master"} title={media.filename}>
        <StatusBadge status={media.status} />
        <Link href={`/admin/projects/${media.project.id}`} className="text-sm text-mist-400 hover:text-mist-100">
          ← {media.project.name}
        </Link>
      </PageHeader>
      <MediaWorkspace media={media} caps={capabilities()} initialTab={tool as never} />
    </>
  );
}
