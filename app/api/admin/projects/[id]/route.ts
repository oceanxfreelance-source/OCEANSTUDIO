import { requireAdmin } from "@/lib/auth/admin";
import { json, parseJson, route } from "@/lib/http";
import { deleteProject, getProject, projectInputSchema, updateProject } from "@/server/projects";

export const GET = route<{ id: string }>(async (req, { id }) => {
  await requireAdmin(req);
  return json({ project: await getProject(id) });
});

export const PATCH = route<{ id: string }>(async (req, { id }) => {
  const { admin } = await requireAdmin(req);
  const input = await parseJson(req, projectInputSchema.partial());
  return json({ project: await updateProject(id, input, admin.id) });
});

export const DELETE = route<{ id: string }>(async (req, { id }) => {
  const { admin } = await requireAdmin(req);
  return json(await deleteProject(id, admin.id));
});
