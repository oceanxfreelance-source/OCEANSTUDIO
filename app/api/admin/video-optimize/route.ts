import { revalidatePath } from "next/cache";
import { getAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { deleteVideoIfUnused, isOurVideo } from "@/lib/video-storage";
import { optimiseVideo, VideoError } from "@/lib/video-transcode";

// Converting a clip takes ~30–90 s on the server.
export const maxDuration = 300;
export const runtime = "nodejs";

/**
 * Admin-only: convert an uploaded video into the phone-friendly version and
 * switch every place that uses it (portfolio, locations, home hero) to the new
 * file. The original upload is then deleted to save storage.
 */
export async function POST(req: Request) {
  if (!(await getAdmin())) return Response.json({ error: "Not signed in" }, { status: 401 });
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) return Response.json({ error: "Bad origin" }, { status: 403 });

  const { url } = (await req.json().catch(() => ({}))) as { url?: string };
  if (!url || !isOurVideo(url)) return Response.json({ error: "Not an uploaded video" }, { status: 400 });
  if (/\/videos\/web\//.test(url)) return Response.json({ url });

  try {
    const optimised = await optimiseVideo(url);
    await db.$transaction([
      db.portfolioItem.updateMany({ where: { videoUrl: url }, data: { videoUrl: optimised.url } }),
      db.$executeRaw`UPDATE "portfolio_items" SET "video_urls" = array_replace("video_urls", ${url}, ${optimised.url}) WHERE ${url} = ANY("video_urls")`,
      db.location.updateMany({ where: { videoUrl: url }, data: { videoUrl: optimised.url } }),
      db.setting.updateMany({ where: { key: "hero.videoUrl", value: url }, data: { value: optimised.url } }),
    ]);
    await deleteVideoIfUnused(url, optimised.url);
    revalidatePath("/", "layout");
    return Response.json(optimised);
  } catch (err) {
    if (err instanceof VideoError) return Response.json({ error: err.message }, { status: 400 });
    console.error("video optimise failed", err);
    return Response.json({ error: "Optimising failed. Please try again." }, { status: 500 });
  }
}
