/**
 * Create (or reset the password of) the Superadmin.
 *
 *   npm run admin:create -- owner@example.com "Your Name"
 *
 * You'll be asked for the password (it's never stored in code or shown).
 * There is no public registration — this script is the only way to add an admin.
 */
import { createInterface } from "node:readline";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/password";

async function ask(question: string, hidden = false): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) {
    const out = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
    out._writeToOutput = (s: string) => {
      if (s.includes(question)) out.output.write(s);
    };
  }
  return new Promise((resolve) =>
    rl.question(question, (a) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(a);
    }),
  );
}

async function main() {
  const email = (process.argv[2] ?? (await ask("Admin email: "))).trim().toLowerCase();
  const name = (process.argv[3] ?? (await ask("Name: "))).trim() || "Ocean X Admin";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Please enter a valid email.");
  const password = process.env.ADMIN_PASSWORD ?? (await ask("Password (min 12 characters): ", true));
  if (password.length < 12) throw new Error("Password must be at least 12 characters.");

  const db = new PrismaClient();
  const passwordHash = await hashPassword(password);
  const admin = await db.adminUser.upsert({
    where: { email },
    create: { email, name, passwordHash, role: "OWNER" },
    update: { passwordHash, name },
  });
  await db.adminSession.deleteMany({ where: { adminId: admin.id } }); // sign out old sessions
  await db.$disconnect();
  console.log(`✔ Superadmin ready: ${admin.email}. Sign in at /superadmin`);
}

main().catch((e) => {
  console.error("✖", (e as Error).message);
  process.exit(1);
});
