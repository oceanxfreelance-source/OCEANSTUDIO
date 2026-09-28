import { execSync, spawn, type ChildProcess } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { applyTestEnv, TEST_ENV } from "./env";

let moto: ChildProcess | null = null;
let createdDb: string | null = null;

async function reachable(url: string) {
  try {
    await fetch(url);
    return true;
  } catch {
    return false;
  }
}

function withDatabase(url: string, name: string) {
  const u = new URL(url);
  u.pathname = `/${name}`;
  return u.toString();
}

/**
 * Every run gets its own freshly created, uniquely named database, migrated
 * with `prisma migrate deploy`. No existing database is ever reset; only the
 * database created here is dropped at teardown.
 */
export async function setup() {
  applyTestEnv();
  const base = process.env.TEST_DATABASE_URL ?? "postgresql://oceanx:oceanx@localhost:5432/postgres";
  createdDb = `oceanx_it_${Date.now().toString(36)}_${process.pid}`;
  const admin = new PrismaClient({ datasourceUrl: withDatabase(base, "postgres") });
  await admin.$executeRawUnsafe(`CREATE DATABASE "${createdDb}"`);
  await admin.$disconnect();
  const url = withDatabase(base, createdDb);
  process.env.DATABASE_URL = url;
  process.env.OCEANX_IT_DATABASE_URL = url; // read by setup.ts in the test workers
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });

  if (!(await reachable(TEST_ENV.STORAGE_ENDPOINT!))) {
    const port = new URL(TEST_ENV.STORAGE_ENDPOINT!).port;
    moto = spawn("moto_server", ["-H", "127.0.0.1", "-p", port], { stdio: "ignore" });
    for (let i = 0; i < 50 && !(await reachable(TEST_ENV.STORAGE_ENDPOINT!)); i++) await new Promise((r) => setTimeout(r, 200));
  }
  execSync("npx tsx scripts/configure-bucket-cors.ts --create", { stdio: "inherit", env: { ...process.env } });
  const { default: IORedis } = await import("ioredis");
  const r = new IORedis(TEST_ENV.REDIS_URL!);
  await r.flushdb(); // dedicated Redis logical DB for tests
  await r.quit();
}

export async function teardown() {
  moto?.kill();
  if (createdDb && process.env.KEEP_TEST_DB !== "1") {
    const base = process.env.TEST_DATABASE_URL ?? "postgresql://oceanx:oceanx@localhost:5432/postgres";
    const admin = new PrismaClient({ datasourceUrl: withDatabase(base, "postgres") });
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${createdDb}" WITH (FORCE)`);
    await admin.$disconnect();
  }
}
