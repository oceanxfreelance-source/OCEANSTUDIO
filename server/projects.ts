import { z } from "zod";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { conflict, notFound } from "@/lib/errors";

export const projectInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(4000).optional().nullable(),
  shootDate: z.coerce.date().optional().nullable(),
  clientId: z.string().min(1).max(64).optional().nullable(),
  status: z.enum(["DRAFT", "PROCESSING", "READY", "ACTIVE", "ARCHIVED"]).optional(),
});

export async function listProjects(opts: { status?: string; q?: string } = {}) {
  return db.project.findMany({
    where: {
      ...(opts.status ? { status: opts.status as never } : {}),
      ...(opts.q ? { name: { contains: opts.q, mode: "insensitive" as const } } : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      client: { select: { id: true, name: true } },
      _count: { select: { media: true, deliveries: true } },
    },
  });
}

export async function getProject(id: string) {
  const project = await db.project.findUnique({
    where: { id },
    include: { client: true, _count: { select: { media: true, deliveries: true, versions: true } } },
  });
  if (!project) throw notFound("Project not found");
  return project;
}

export async function createProject(input: z.infer<typeof projectInputSchema>, adminId: string) {
  if (input.clientId && !(await db.client.findUnique({ where: { id: input.clientId } }))) throw notFound("Client not found");
  const project = await db.project.create({
    data: {
      name: input.name,
      description: input.description ?? null,
      shootDate: input.shootDate ?? null,
      clientId: input.clientId ?? null,
      status: input.status ?? "DRAFT",
      ...(input.clientId ? { access: { create: { clientId: input.clientId } } } : {}),
    },
  });
  await audit({ action: "PROJECT_CREATED", actorType: "ADMIN", actorId: adminId, projectId: project.id, details: { name: project.name } });
  return project;
}

export async function updateProject(id: string, input: Partial<z.infer<typeof projectInputSchema>>, adminId: string) {
  await getProject(id);
  const project = await db.project.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.shootDate !== undefined ? { shootDate: input.shootDate } : {}),
      ...(input.clientId !== undefined ? { clientId: input.clientId } : {}),
      ...(input.status !== undefined ? { status: input.status, archivedAt: input.status === "ARCHIVED" ? new Date() : null } : {}),
    },
  });
  await audit({
    action: input.status === "ARCHIVED" ? "PROJECT_ARCHIVED" : "PROJECT_UPDATED",
    actorType: "ADMIN",
    actorId: adminId,
    projectId: id,
    details: JSON.parse(JSON.stringify(input)),
  });
  return project;
}

/**
 * Masters are sacred: a project that contains uploaded files can only be
 * ARCHIVED, never deleted. Empty projects may be deleted.
 */
export async function deleteProject(id: string, adminId: string) {
  const project = await getProject(id);
  if (project._count.media > 0 || project._count.deliveries > 0) {
    throw conflict("Projects containing master files cannot be deleted. Archive the project instead.");
  }
  await db.project.delete({ where: { id } });
  await audit({ action: "PROJECT_DELETED", actorType: "ADMIN", actorId: adminId, details: { id, name: project.name } });
  return { deleted: true };
}
