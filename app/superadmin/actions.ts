"use server";

import { redirect } from "next/navigation";
import { login, logout } from "@/lib/auth";

export type LoginState = { error?: string } | undefined;

export async function loginAction(_prev: LoginState, fd: FormData): Promise<LoginState> {
  const email = String(fd.get("email") ?? "");
  const password = String(fd.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };
  if (email.length > 200 || password.length > 200) return { error: "Incorrect email or password." };
  const res = await login(email, password);
  if (!res.ok) return { error: res.error };
  redirect("/superadmin");
}

export async function logoutAction() {
  await logout();
  redirect("/superadmin/login");
}
