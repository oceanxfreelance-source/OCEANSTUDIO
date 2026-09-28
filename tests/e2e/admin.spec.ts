import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { E2E_ADMIN } from "./env";

export const SHARE_FILE = join(__dirname, ".e2e-delivery.json");

test("admin: login → client → project → upload → grade → publish → 48-hour delivery", async ({ page }) => {
  page.on("pageerror", (e) => console.log("[pageerror]", e.message));
  // unauthenticated admin routes redirect to login
  await page.goto("/admin/projects");
  await expect(page).toHaveURL(/\/admin\/login/);

  await page.getByLabel("Email").fill(E2E_ADMIN.email);
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Invalid email or password")).toBeVisible();
  await page.getByLabel("Password").fill(E2E_ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  await page.getByRole("link", { name: "Clients" }).click();
  await page.getByRole("button", { name: "New client" }).click();
  await page.getByLabel("Name").fill("Surf Client");
  await page.getByRole("button", { name: "Add client" }).click();
  await expect(page.getByRole("cell", { name: "Surf Client" })).toBeVisible();

  await page.getByRole("link", { name: "Projects" }).click();
  await page.getByRole("button", { name: "New project" }).click();
  await page.getByLabel("Project name").fill("John's Surf Session");
  await page.getByLabel("Client").selectOption({ label: "Surf Client" });
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByRole("heading", { name: "John's Surf Session" })).toBeVisible();

  const jpg = await sharp({ create: { width: 1600, height: 1067, channels: 3, background: "#2a6f97" } })
    .composite([{ input: Buffer.from('<svg width="1600" height="1067"><circle cx="800" cy="530" r="300" fill="#f4d58d"/></svg>') }])
    .jpeg({ quality: 94 })
    .toBuffer();
  // (ASCII-only path: the per-test output directory contains "→", which the browser file picker cannot read)
  const file = join(mkdtempSync(join(tmpdir(), "oceanx-e2e-")), "DSC_0001.jpg");
  writeFileSync(file, jpg);
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.getByText("Drop originals here or click to browse").click()]);
  await chooser.setFiles(file);
  await expect(page.getByText("uploaded — ingesting")).toBeVisible();
  // the worker ingests (checksum, metadata, previews); the grid refreshes itself
  const card = page.getByRole("link", { name: /DSC_0001\.jpg/ });
  await expect(card.getByText(/1 v · 0 pub/)).toBeVisible({ timeout: 90_000 });

  await card.click();
  await expect(page.getByRole("heading", { name: "DSC_0001.jpg" })).toBeVisible();
  await expect(page.getByText(/^[a-f0-9]{64}$/)).toBeVisible(); // master SHA-256
  await page.getByRole("tab", { name: "Color" }).click();
  await page.getByRole("button", { name: "Ocean Blue" }).click();
  await page.getByRole("button", { name: "Create graded version" }).click();
  await expect(page.getByText("Queued — a new COLOR GRADED version")).toBeVisible();
  await expect(page.locator("ol li").filter({ hasText: "COLOR GRADED · OCEAN BLUE" })).toBeVisible({ timeout: 120_000 });

  // compare original vs enhanced, zoom to 100%
  await page.getByRole("radio", { name: "Side by side" }).click();
  await page.getByRole("radio", { name: "100%" }).click();
  await expect(page.getByText(/100% of the color graded/i)).toBeVisible();

  // publish the graded version and the original
  const publishButtons = page.getByRole("button", { name: "Publish to client" });
  await publishButtons.first().click();
  await expect(page.getByRole("button", { name: "Unpublish" })).toHaveCount(1);
  await page.getByRole("button", { name: "Publish to client" }).first().click();
  await expect(page.getByRole("button", { name: "Unpublish" })).toHaveCount(2);

  await page.getByRole("link", { name: /John's Surf Session/ }).click();
  await page.getByRole("button", { name: "Create client delivery" }).click();
  await page.getByRole("button", { name: "Enhanced + Color Graded" }).click();
  await page.getByRole("button", { name: "Color Graded", exact: true }).click();
  await page.getByRole("button", { name: "Create 48-hour delivery" }).click();
  await expect(page.getByText("Private gallery ready to share")).toBeVisible();
  const link = (await page.locator("dialog span.truncate").first().textContent())!.trim();
  const password = (await page.locator("dialog .font-mono span").nth(1).textContent())!.trim();
  expect(link).toMatch(/\/gallery\/[A-Za-z0-9]{32}$/);
  expect(password).toMatch(/^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/);
  writeFileSync(SHARE_FILE, JSON.stringify({ link, password }));

  await page.getByRole("button", { name: "View delivery" }).click();
  await expect(page.getByRole("heading", { name: "John's Surf Session" })).toBeVisible();
  await expect(page.getByText("ACTIVE").first()).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("button", { name: "Copy password" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Revoke" })).toBeVisible();

  await page.getByRole("link", { name: "Processing" }).click();
  await expect(page.getByRole("cell", { name: /Color grade · Ocean Blue/ })).toBeVisible();
  await page.getByRole("link", { name: "Storage" }).click();
  await expect(page.getByRole("cell", { name: "Master storage", exact: true })).toBeVisible();
});
