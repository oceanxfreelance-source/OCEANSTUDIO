/** Isolated infrastructure for integration tests (override via environment). */
export const TEST_ENV: Record<string, string> = {
  NODE_ENV: "test",
  APP_URL: "http://localhost:3000",
  AUTH_SECRET: "integration-test-secret-integration-test-secret-0123456789",
  CRON_SECRET: "integration-cron-secret",
  STORAGE_ENDPOINT: process.env.TEST_STORAGE_ENDPOINT ?? "http://127.0.0.1:9100",
  STORAGE_BUCKET: "oceanx-test",
  STORAGE_ACCESS_KEY: "test",
  STORAGE_SECRET_KEY: "test-secret",
  STORAGE_REGION: "us-east-1",
  STORAGE_FORCE_PATH_STYLE: "true",
  REDIS_URL: process.env.TEST_REDIS_URL ?? "redis://127.0.0.1:6379/5",
  AI_IMAGE_PROVIDER: "classical",
  AI_VIDEO_PROVIDER: "ffmpeg",
  UPLOAD_PART_SIZE: String(5 * 1024 * 1024),
  LOG_LEVEL: "warn",
  TRUST_PROXY: "true",
};

export function applyTestEnv() {
  for (const [k, v] of Object.entries(TEST_ENV)) process.env[k] = v;
  // the per-run database created in global-setup.ts
  if (process.env.OCEANX_IT_DATABASE_URL) process.env.DATABASE_URL = process.env.OCEANX_IT_DATABASE_URL;
}
