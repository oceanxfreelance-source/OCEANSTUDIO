import "server-only";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { revalidatePath } from "next/cache";
import { makePreview, PreviewError } from "./clip-preview";
import { db } from "./db";
import { withRangeRelay } from "./range-relay";
import { deletePublic, localPrivatePath, putPublic, signedPrivateUrl, storageDriver } from "./storage";

/** Make the public preview + cover frame for a clip and mark it READY (or FAILED). */
export async function processClip(id: string): Promise<{ ok: boolean; error?: string }> {
  const clip = await db.clip.findUnique({ where: { id } });
  if (!clip) return { ok: false, error: "Clip not found" };
  const dir = await mkdtemp(join(tmpdir(), "oxc-"));
  try {
    const out =
      storageDriver() === "local"
        ? await makePreview(localPrivatePath(clip.originalKey), dir)
        : await withRangeRelay(await signedPrivateUrl(clip.originalKey, 900), (url) => makePreview(url, dir));
    const [previewUrl, posterUrl] = await Promise.all([
      putPublic(`previews/${clip.code}.mp4`, await readFile(out.preview), "video/mp4"),
      out.poster ? putPublic(`previews/${clip.code}.jpg`, await readFile(out.poster), "image/jpeg") : null,
    ]);
    await db.clip.update({ where: { id }, data: { previewUrl, posterUrl, seconds: out.seconds, status: "READY", error: null } });
    await Promise.all([clip.previewUrl !== previewUrl && deletePublic(clip.previewUrl), clip.posterUrl !== posterUrl && deletePublic(clip.posterUrl)]);
    revalidatePath("/clips");
    return { ok: true };
  } catch (e) {
    const error = e instanceof PreviewError ? e.message : "The preview couldn't be made. Try again.";
    if (!(e instanceof PreviewError)) console.error("clip preview failed", e);
    await db.clip.update({ where: { id }, data: { status: "FAILED", error } });
    return { ok: false, error };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
