/**
 * Helpers to read HTML form submissions (FormData) into plain objects that zod
 * can validate. Checkboxes send "on" when ticked and nothing when not.
 */
export function formToObject(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string" && !(k in out)) out[k] = v;
  return out;
}

export function checkbox(fd: FormData, name: string): boolean {
  const v = fd.get(name);
  return v === "on" || v === "true" || v === "1";
}

/** Comma-separated media ids from the ImagePicker hidden input. */
export function idList(fd: FormData, name: string): string[] {
  const v = fd.get(name);
  if (typeof v !== "string") return [];
  return [...new Set(v.split(",").map((s) => s.trim()).filter((s) => /^[a-z0-9]{20,40}$/i.test(s)))].slice(0, 40);
}

export type FormState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string>; message?: string } | undefined;

/** First zod error per field, for showing next to inputs. */
export function fieldErrors(issues: { path: (string | number)[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const k = String(i.path[0] ?? "form");
    out[k] ??= i.message;
  }
  return out;
}
