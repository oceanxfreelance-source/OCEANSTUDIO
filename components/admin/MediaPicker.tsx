import Link from "next/link";
import { cx, EmptyState, Select } from "@/components/ui";

export interface PickerItem {
  id: string;
  filename: string;
  thumbUrl: string | null;
  mediaType: string;
  projectName: string;
}

/** UPLOAD / SELECT: pick a master from any project (uploads happen in the project page). */
export function MediaPicker({ items, selectedId, basePath, projects, projectId }: { items: PickerItem[]; selectedId?: string; basePath: string; projects: { id: string; name: string }[]; projectId?: string }) {
  return (
    <div className="space-y-3">
      <form action={basePath} className="flex items-center gap-2">
        <Select name="project" defaultValue={projectId ?? ""} aria-label="Filter by project" className="max-w-xs">
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <button className="h-9 rounded-lg border border-ink-600 px-3 text-xs text-mist-200 hover:border-ink-500" type="submit">
          Filter
        </button>
        <Link href="/admin/projects" className="ml-auto text-xs text-ocean-300 hover:underline">
          Upload in a project →
        </Link>
      </form>
      {items.length === 0 ? (
        <EmptyState title="No ingested files">Upload originals to a project first.</EmptyState>
      ) : (
        <ul className="flex gap-2 overflow-x-auto pb-2">
          {items.map((m) => (
            <li key={m.id} className="shrink-0">
              <Link
                href={`${basePath}?media=${m.id}${projectId ? `&project=${projectId}` : ""}`}
                aria-current={m.id === selectedId ? "true" : undefined}
                className={cx("block w-36 overflow-hidden rounded-lg border", m.id === selectedId ? "border-ocean-400" : "border-ink-700 hover:border-ink-500")}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {m.thumbUrl ? <img src={m.thumbUrl} alt="" className="aspect-[4/3] w-full object-cover" loading="lazy" /> : <div className="aspect-[4/3] bg-ink-800" />}
                <p className="truncate px-2 py-1.5 text-[11px] text-mist-300">
                  {m.mediaType === "RAW" && <span className="mr-1 text-ocean-300">RAW</span>}
                  {m.filename}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
