/**
 * Create (or reset the password of) an admin user.
 *   ADMIN_EMAIL=me@studio.com ADMIN_PASSWORD='…' ADMIN_NAME='Me' npm run admin:create
 * Credentials come from the environment — never from source code.
 */
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/crypto";

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || "Studio Admin";
  if (!email || !password) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD");
  if (password.length < 12) throw new Error("Admin password must be at least 12 characters");
  const passwordHash = await hashPassword(password);
  const admin = await db.adminUser.upsert({
    where: { email },
    create: { email, name, passwordHash, role: "OWNER" },
    update: { passwordHash, name, disabledAt: null },
  });
  // invalidate existing sessions on password reset
  await db.session.updateMany({ where: { adminUserId: admin.id, revokedAt: null }, data: { revokedAt: new Date() } });
  console.log(`Admin ready: ${admin.email}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
