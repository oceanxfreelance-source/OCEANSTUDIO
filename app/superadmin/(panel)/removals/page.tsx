import Link from "next/link";
import { revalidatePath } from "next/cache";
import { Badge, Empty, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Removal requests" };

async function markDone(id: string) {
  "use server";
  await requireAdmin();
  await db.removalRequest.update({ where: { id }, data: { doneAt: new Date() } });
  revalidatePath("/superadmin", "layout");
}

async function restoreClip(requestId: string, clipId: string) {
  "use server";
  await requireAdmin();
  await db.clip.update({ where: { id: clipId }, data: { hidden: false } });
  await db.removalRequest.update({ where: { id: requestId }, data: { doneAt: new Date() } });
  revalidatePath("/clips");
  revalidatePath("/superadmin", "layout");
}

export default async function Removals() {
  await requireAdmin();
  const requests = await db.removalRequest.findMany({ orderBy: [{ doneAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }], take: 200 });
  const clips = await db.clip.findMany({ where: { id: { in: requests.map((r) => r.clipId).filter((x): x is string => !!x) } }, select: { id: true, hidden: true, posterUrl: true } });
  return (
    <>
      <PageHeader title="Removal requests" subtitle="Clips are taken out of the gallery as soon as someone asks. Delete the clip, or restore it if the request was a mistake." />
      {requests.length === 0 ? (
        <Empty>No requests.</Empty>
      ) : (
        <ul className="divide-y divide-slate/10 rounded-xl border border-slate/15 bg-white">
          {requests.map((r) => {
            const clip = clips.find((c) => c.id === r.clipId);
            return (
              <li key={r.id} className="flex flex-wrap items-start gap-4 p-4">
                <span className="block h-20 w-16 shrink-0 overflow-hidden rounded bg-ink">
                  {clip?.posterUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={clip.posterUrl} alt="" className="h-full w-full object-cover" />
                  )}
                </span>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-mono font-semibold">
                    {clip ? <Link href={`/superadmin/clips/${clip.id}`} className="underline">{r.clipCode}</Link> : `${r.clipCode} (no such clip)`}{" "}
                    {r.doneAt ? <Badge tone="green">Done</Badge> : <Badge tone="amber">New</Badge>} {clip?.hidden && <Badge>Hidden</Badge>}
                  </p>
                  {r.reason && <p className="mt-1 whitespace-pre-line">{r.reason}</p>}
                  <p className="mt-1 text-xs text-slate">
                    {formatDateTime(r.createdAt)}
                    {r.contact && ` · ${r.contact}`}
                  </p>
                </div>
                {!r.doneAt && (
                  <div className="flex flex-wrap gap-2">
                    <form action={markDone.bind(null, r.id)}>
                      <button className="rounded-lg bg-abyss px-4 py-2 text-sm font-semibold text-white">Keep hidden · done</button>
                    </form>
                    {clip && (
                      <form action={restoreClip.bind(null, r.id, clip.id)}>
                        <button className="rounded-lg border border-slate/30 bg-white px-4 py-2 text-sm font-semibold">Restore clip</button>
                      </form>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
