"use server";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import type { FormState } from "@/lib/forms";
import { hashPassword, verifyPassword } from "@/lib/password";

export async function changePassword(_prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("next") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  const user = await db.adminUser.findUniqueOrThrow({ where: { id: admin.id } });
  if (!(await verifyPassword(current, user.passwordHash))) return { error: "Your current password is incorrect.", fieldErrors: { current: "Incorrect" } };
  if (next.length < 12) return { error: "Use at least 12 characters.", fieldErrors: { next: "At least 12 characters" } };
  if (next.length > 200) return { error: "Password is too long.", fieldErrors: { next: "Too long" } };
  if (next !== confirm) return { error: "The new passwords don't match.", fieldErrors: { confirm: "Doesn't match" } };
  await db.adminUser.update({ where: { id: admin.id }, data: { passwordHash: await hashPassword(next) } });
  return { ok: true, message: "Password changed." };
}

export async function signOutEverywhere(): Promise<void> {
  const admin = await requireAdmin();
  await db.adminSession.deleteMany({ where: { adminId: admin.id } });
}
