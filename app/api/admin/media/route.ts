import { getAdmin } from "@/lib/auth";
import { MediaError, saveImage } from "@/lib/media";

/**
 * Admin-only image upload used by the ImagePicker. Returns the new asset id.
 * The browser shrinks photos before sending, so requests stay small.
 */
export async function POST(req: Request) {
  const admin = await getAdmin();
  if (!admin) return Response.json({ error: "Not signed in" }, { status: 401 });

  // Same-origin check (defence in depth against cross-site uploads).
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) return Response.json({ error: "Bad origin" }, { status: 403 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ error: "No file received" }, { status: 400 });
  const alt = typeof form?.get("alt") === "string" ? String(form?.get("alt")) : "";

  try {
    const asset = await saveImage(Buffer.from(await file.arrayBuffer()), alt);
    return Response.json(asset, { status: 201 });
  } catch (err) {
    if (err instanceof MediaError) return Response.json({ error: err.message }, { status: 400 });
    console.error("upload failed", err);
    return Response.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
