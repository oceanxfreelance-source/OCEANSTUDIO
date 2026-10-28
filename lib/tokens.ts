import { randomBytes } from "node:crypto";

/** Unguessable token for private order / booking links. */
export function privateToken(): string {
  return randomBytes(18).toString("base64url");
}

export function isToken(v: string): boolean {
  return /^[A-Za-z0-9_-]{20,40}$/.test(v);
}
