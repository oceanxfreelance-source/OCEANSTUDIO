import { requireClient } from "@/lib/auth/client";
import { json, route } from "@/lib/http";
import { clientGallery } from "@/server/deliveries";

export const GET = route(async (req) => {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const { delivery } = await requireClient(req, token);
  return json(await clientGallery(delivery));
});
