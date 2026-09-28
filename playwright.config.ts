import { defineConfig, devices } from "@playwright/test";
import { E2E_PORT } from "./tests/e2e/env";

/**
 * End-to-end tests run the production build (`next start`, started in
 * global-setup after the per-run database exists) plus the real background
 * worker against Postgres, Redis and S3-compatible storage. Run `npm run build` first.
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 5 * 60_000,
  expect: { timeout: 60_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    trace: "retain-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : undefined,
  },
  projects: [
    { name: "admin-desktop", testMatch: /admin\.spec\.ts/, use: { ...devices["Desktop Chrome"], viewport: { width: 1920, height: 1080 } } },
    { name: "client-mobile", testMatch: /gallery\.spec\.ts/, dependencies: ["admin-desktop"], use: { ...devices["iPhone 13"], browserName: "chromium" } },
  ],
});
