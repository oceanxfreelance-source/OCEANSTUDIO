import { notFound } from "next/navigation";
import { ProjectWorkspace } from "@/components/admin/ProjectWorkspace";
import { db } from "@/lib/db";
import { displayStatus } from "@/server/deliveries";
import { listClients } from "@/server/clients";
import { listMedia } from "@/server/media";
import { mediaView } from "@/server/views";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await db.project.findUnique({ where: { id }, include: { client: true } });
  if (!project) notFound();
  const [media, clients, deliveries] = await Promise.all([
    listMedia(id),
    listClients(),
    db.delivery.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
      include: { client: { select: { name: true } }, _count: { select: { files: true, downloads: true, favorites: true } } },
    }),
  ]);
  return (
    <ProjectWorkspace
      project={{
        id: project.id,
        name: project.name,
        status: project.status,
        description: project.description,
        shootDate: project.shootDate?.toISOString() ?? null,
        client: project.client ? { id: project.client.id, name: project.client.name } : null,
      }}
      media={await Promise.all(media.map(mediaView))}
      clients={clients.map((c) => ({ id: c.id, name: c.name }))}
      deliveries={deliveries.map((d) => ({
        id: d.id,
        number: d.number,
        title: d.title,
        client: d.client.name,
        createdAt: d.createdAt.toISOString(),
        expiresAt: d.expiresAt.toISOString(),
        status: displayStatus(d),
        files: d._count.files,
        downloads: d._count.downloads,
        favorites: d._count.favorites,
      }))}
    />
  );
}
