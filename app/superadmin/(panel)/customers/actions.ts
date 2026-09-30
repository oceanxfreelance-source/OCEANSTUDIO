"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { fieldErrors, formToObject, type FormState } from "@/lib/forms";
import { customerSchema } from "@/lib/validation";

export async function saveCustomer(id: string | null, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = customerSchema.safeParse(formToObject(fd));
  if (!parsed.success) return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error.issues) };
  const v = parsed.data;
  const data = { name: v.name, instagram: v.instagram ?? null, email: v.email ?? null, whatsapp: v.whatsapp ?? null, country: v.country ?? null, notes: v.notes };
  if (id) {
    await db.customer.update({ where: { id }, data });
    revalidatePath("/superadmin", "layout");
    return { ok: true, message: "Customer saved." };
  }
  const c = await db.customer.create({ data });
  redirect(`/superadmin/customers/${c.id}`);
}

export async function deleteCustomer(id: string) {
  await requireAdmin();
  const c = await db.customer.findUniqueOrThrow({ where: { id }, include: { _count: { select: { bookings: true, sessions: true } } } });
  if (c._count.bookings || c._count.sessions) throw new Error("Customers with bookings or sessions can't be deleted.");
  await db.customer.delete({ where: { id } });
  revalidatePath("/superadmin", "layout");
  redirect("/superadmin/customers");
}
