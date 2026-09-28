import { randomBytes } from "node:crypto";

/** Sortable, URL/key-safe identifier (time prefix + 80 random bits). */
export function newId(): string {
  const time = Date.now().toString(36).padStart(9, "0");
  const rand = randomBytes(10).toString("base64url").replace(/[-_]/g, "x").toLowerCase();
  return `c${time}${rand}`;
}
