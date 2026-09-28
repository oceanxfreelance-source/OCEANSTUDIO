import { execSync, spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { E2E_ADMIN, E2E_ENV, E2E_PORT, STATE_FILE } from "./env";

async function reachable(url: string) {
  try {
    await fetch(url);
    return true;
  } catch {
    return false;
  }
}

/** Fresh uniquely named database + bucket + admin, then start the real worker. */
export default async function globalSetup() {
  const base = new URL(process.env.TEST_DATABASE_URL ?? "postgresql://oceanx:oceanx@localhost:5432/postgres");
  const name = `oceanx_e2e_${Date.now().toString(36)}`;
  base.pathname = "/postgres";
  const admin = new PrismaClient({ datasourceUrl: base.toString() });
  await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
  await admin.$disconnect();
  base.pathname = `/${name}`;
  const databaseUrl = base.toString();
  const env = { ...process.env, ...E2E_ENV, DATABASE_URL: databaseUrl, NODE_ENV: "production" } as NodeJS.ProcessEnv;
  execSync("npx prisma migrate deploy", { stdio: "inherit", env });

  let motoPid: number | null = null;
  if (!(await reachable(E2E_ENV.STORAGE_ENDPOINT!))) {
    const m = spawn("moto_server", ["-H", "127.0.0.1", "-p", new URL(E2E_ENV.STORAGE_ENDPOINT!).port], { stdio: "ignore", detached: true });
    m.unref();
    motoPid = m.pid ?? null;
    for (let i = 0; i < 50 && !(await reachable(E2E_ENV.STORAGE_ENDPOINT!)); i++) await new Promise((r) => setTimeout(r, 200));
  }
  execSync("npx tsx scripts/configure-bucket-cors.ts --create", { stdio: "inherit", env });
  execSync("npx tsx scripts/create-admin.ts", { stdio: "inherit", env: { ...env, ADMIN_EMAIL: E2E_ADMIN.email, ADMIN_PASSWORD: E2E_ADMIN.password, ADMIN_NAME: E2E_ADMIN.name } });
  const { default: IORedis } = await import("ioredis");
  const r = new IORedis(E2E_ENV.REDIS_URL!);
  await r.flushdb();
  await r.quit();

  const worker = spawn("npx", ["tsx", "workers/index.ts"], { env, stdio: "inherit", detached: true });
  worker.unref();
  const web = spawn("npx", ["next", "start", "-p", String(E2E_PORT)], { env, stdio: "inherit", detached: true });
  web.unref();
  writeFileSync(STATE_FILE, JSON.stringify({ databaseUrl, databaseName: name, workerPid: worker.pid, webPid: web.pid, motoPid }));
  for (let i = 0; i < 120; i++) {
    if (await reachable(`http://localhost:${E2E_PORT}/api/health`)) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Web server did not start — run `npm run build` before `npm run test:e2e`.");
}
