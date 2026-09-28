import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const E2E_PORT = 3100;
const STATE = join(__dirname, ".e2e-state.json");

/** The database is created per run by global-setup; its URL is shared via a state file. */
function databaseUrl(): string {
  if (existsSync(STATE)) return JSON.parse(readFileSync(STATE, "utf8")).databaseUrl as string;
  return "postgresql://oceanx:oceanx@localhost:5432/postgres";
}

export const E2E_ENV: Record<string, string> = {
  NODE_ENV: "production",
  APP_URL: `http://localhost:${E2E_PORT}`,
  DATABASE_URL: databaseUrl(),
  AUTH_SECRET: "e2e-secret-e2e-secret-e2e-secret-e2e-secret-0123456789",
  CRON_SECRET: "e2e-cron",
  STORAGE_ENDPOINT: process.env.TEST_STORAGE_ENDPOINT ?? "http://127.0.0.1:9100",
  STORAGE_BUCKET: "oceanx-e2e",
  STORAGE_ACCESS_KEY: "test",
  STORAGE_SECRET_KEY: "test-secret",
  STORAGE_REGION: "us-east-1",
  STORAGE_FORCE_PATH_STYLE: "true",
  REDIS_URL: process.env.TEST_REDIS_URL ?? "redis://127.0.0.1:6379/6",
  AI_IMAGE_PROVIDER: "classical",
  AI_VIDEO_PROVIDER: "ffmpeg",
  UPLOAD_PART_SIZE: String(5 * 1024 * 1024),
  LOG_LEVEL: "warn",
  PATH: process.env.PATH ?? "",
};

export const E2E_ADMIN = { email: "e2e-admin@oceanx.test", password: "e2e-admin-password-123", name: "E2E Admin" };
export const STATE_FILE = STATE;
