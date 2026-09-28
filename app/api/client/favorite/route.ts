import { z } from "zod";
import { requireClient } from "@/lib/auth/client";
import { json, parseJson, route } from "@/lib/http";
import { toggleFavorite } from "@/server/deliveries";

const schema = z.object({ token: z.string().min(1).max(64), fileId: z.string().min(1).max(64), favorite: z.boolean() });

export const POST = route(async (req) => {
  const body = await parseJson(req, schema);
  const { delivery } = await requireClient(req, body.token);
  return json(await toggleFavorite(delivery, body.fileId, body.favorite));
});
