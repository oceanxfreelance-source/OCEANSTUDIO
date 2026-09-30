import "server-only";
import type { Prisma } from "@prisma/client";
import { nextReference } from "./counters";
import { db } from "./db";
import type { BookingRequestInput } from "./validation";

/**
 * Save a public booking request.
 *
 * The customer record is matched by email, WhatsApp or Instagram so repeat
 * visitors build up one history in the admin's customer list. Visitors never
 * see or log in to this record.
 */
export async function createBookingRequest(input: BookingRequestInput) {
  // Only real, visible services/locations can be linked.
  const service = input.serviceId
    ? await db.service.findFirst({ where: { id: input.serviceId, published: true, status: { not: "HIDDEN" } } })
    : null;
  const location = input.location
    ? await db.location.findFirst({ where: { published: true, OR: [{ id: input.location }, { name: input.location }] } })
    : null;

  return db.$transaction(async (tx) => {
    const customer = await findOrCreateCustomer(tx, input);
    const reference = await nextReference(tx, "booking", "OX-B");
    return tx.booking.create({
      data: {
        reference,
        customerId: customer.id,
        serviceId: service?.id ?? null,
        serviceName: service?.name ?? "",
        locationId: location?.id ?? null,
        locationText: location?.name ?? input.location ?? "",
        fullName: input.fullName,
        instagram: input.instagram ?? null,
        email: input.email ?? null,
        whatsapp: input.whatsapp ?? null,
        preferredDate: input.preferredDate ?? null,
        preferredTime: input.preferredTime ?? null,
        people: input.people ?? null,
        message: input.message ?? "",
      },
    });
  });
}

const digits = (s: string) => s.replace(/[^\d]/g, "");

async function findOrCreateCustomer(tx: Prisma.TransactionClient, input: BookingRequestInput) {
  const or: Prisma.CustomerWhereInput[] = [];
  if (input.email) or.push({ email: input.email });
  if (input.instagram) or.push({ instagram: { equals: input.instagram, mode: "insensitive" } });
  let existing = or.length ? await tx.customer.findFirst({ where: { OR: or }, orderBy: { createdAt: "asc" } }) : null;

  if (!existing && input.whatsapp) {
    // Phone numbers are typed in many formats — compare digits only.
    const wanted = digits(input.whatsapp);
    const candidates = await tx.customer.findMany({ where: { whatsapp: { not: null } }, select: { id: true, whatsapp: true } });
    const hit = candidates.find((c) => c.whatsapp && digits(c.whatsapp) === wanted);
    if (hit) existing = await tx.customer.findUnique({ where: { id: hit.id } });
  }

  if (existing) {
    // Fill in contact details we didn't have yet (never overwrite admin edits).
    return tx.customer.update({
      where: { id: existing.id },
      data: {
        email: existing.email ?? input.email ?? null,
        instagram: existing.instagram ?? input.instagram ?? null,
        whatsapp: existing.whatsapp ?? input.whatsapp ?? null,
      },
    });
  }
  return tx.customer.create({
    data: { name: input.fullName, email: input.email ?? null, instagram: input.instagram ?? null, whatsapp: input.whatsapp ?? null },
  });
}
