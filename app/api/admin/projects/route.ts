import { requireAdmin } from "@/lib/auth/admin";
import { json, parseJson, route } from "@/lib/http";
import { createProject, listProjects, projectInputSchema } from "@/server/projects";

export const GET = route(async (req) => {
  await requireAdmin(req);
  const sp = req.nextUrl.searchParams;
  return json({ projects: await listProjects({ status: sp.get("status") ?? undefined, q: sp.get("q") ?? undefined }) });
});

export const POST = route(async (req) => {
  const { admin } = await requireAdmin(req);
  const input = await parseJson(req, projectInputSchema);
  return json({ project: await createProject(input, admin.id) }, 201);
});
