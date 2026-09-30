"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { CONTENT_FIELDS } from "@/lib/content";
import { db } from "@/lib/db";
import { idList, type FormState } from "@/lib/forms";

/** Save one group of website text fields. */
export async function saveContent(group: string, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const fields = CONTENT_FIELDS.filter((f) => f.group === group);
  const errors: Record<string, string> = {};
  const writes = [];
  for (const f of fields) {
    const type = "type" in f ? f.type : "text";
    let value = type === "image" ? (idList(fd, f.key)[0] ?? "") : String(fd.get(f.key) ?? "").trim();
    if (value.length > 8000) errors[f.key] = "Too long";
    if (type === "url" && value && !/^https?:\/\/\S+$/i.test(value)) errors[f.key] = "Enter a full link starting with https://";
    if (f.key === "social.instagram") value = value.replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/[/?#].*$/, "");
    // Values left at the default aren't stored, so improved defaults still reach the site.
    writes.push(
      value === f.default
        ? db.setting.deleteMany({ where: { key: f.key } })
        : db.setting.upsert({ where: { key: f.key }, create: { key: f.key, value }, update: { value } }),
    );
  }
  if (Object.keys(errors).length) return { error: "Please fix the highlighted fields.", fieldErrors: errors };
  await db.$transaction(writes);
  revalidatePath("/", "layout");
  return { ok: true, message: `${group} saved. The website is updated.` };
}

export async function resetContentField(key: string) {
  await requireAdmin();
  await db.setting.deleteMany({ where: { key } });
  revalidatePath("/", "layout");
}
