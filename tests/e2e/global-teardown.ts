import { existsSync, readFileSync, rmSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { STATE_FILE } from "./env";

export default async function globalTeardown() {
  if (!existsSync(STATE_FILE)) return;
  const state = JSON.parse(readFileSync(STATE_FILE, "utf8")) as { databaseName: string; workerPid?: number; webPid?: number; motoPid?: number };
  for (const pid of [state.webPid, state.workerPid, state.motoPid]) {
    if (pid) {
      try {
        process.kill(-pid, "SIGTERM");
      } catch {
        try {
          process.kill(pid, "SIGTERM");
        } catch {
          /* already gone */
        }
      }
    }
  }
  if (process.env.KEEP_TEST_DB !== "1") {
    const base = new URL(process.env.TEST_DATABASE_URL ?? "postgresql://oceanx:oceanx@localhost:5432/postgres");
    base.pathname = "/postgres";
    const admin = new PrismaClient({ datasourceUrl: base.toString() });
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${state.databaseName}" WITH (FORCE)`);
    await admin.$disconnect();
  }
  rmSync(STATE_FILE, { force: true });
}
