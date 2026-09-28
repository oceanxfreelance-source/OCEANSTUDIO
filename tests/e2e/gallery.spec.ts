import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { e2eDb } from "./db";

const SHARE_FILE = join(__dirname, ".e2e-delivery.json");

test("client on iPhone: password → gallery → preview → exact download → expiry", async ({ page, request }) => {
  const { link, password } = JSON.parse(readFileSync(SHARE_FILE, "utf8")) as { link: string; password: string };
  const path = new URL(link).pathname;

  // clients cannot reach the admin area
  const adminRes = await page.goto("/admin");
  expect(page.url()).toContain("/admin/login");
  expect(adminRes?.headers()["x-robots-tag"]).toContain("noindex");

  const res = await page.goto(path);
  expect(res?.headers()["x-robots-tag"]).toContain("noindex");
  await expect(page.getByText("Your private gallery")).toBeVisible();
  await page.getByLabel("Gallery password").fill("not-the-password");
  await page.getByRole("button", { name: "OPEN GALLERY" }).click();
  await expect(page.getByText("Incorrect password")).toBeVisible();
  await page.getByLabel("Gallery password").fill(password);
  await page.getByRole("button", { name: "OPEN GALLERY" }).click();

  await expect(page.getByRole("heading", { name: "John's Surf Session" })).toBeVisible();
  await expect(page.getByText("Expires in")).toBeVisible();
  await expect(page.locator("text=/^4[78]:[0-5][0-9]:[0-5][0-9]$/")).toBeVisible();
  await expect(page.getByRole("tab", { name: /PHOTOS/ })).toBeVisible();
  await expect(page.getByRole("tab", { name: /VIDEOS/ })).toBeVisible();
  await expect(page.getByRole("tab", { name: /FAVORITES/ })).toBeVisible();

  await page.getByRole("button", { name: "Add to favorites" }).first().click();
  await page.getByRole("tab", { name: /FAVORITES/ }).click();
  await expect(page.getByRole("button", { name: /Open DSC_0001/ })).toBeVisible();

  await page.getByRole("button", { name: /Open DSC_0001/ }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/COLOR GRADED · OCEAN BLUE/)).toBeVisible();
  const [download] = await Promise.all([page.waitForRequest((r) => r.url().includes("/deliveries/") && r.url().includes("X-Amz-Signature")), dialog.getByRole("button", { name: "Download" }).click()]);
  const bytes = await (await request.get(download.url())).body();
  const db = e2eDb();
  const version = await db.mediaVersion.findFirstOrThrow({ where: { label: "COLOR GRADED · OCEAN BLUE" } });
  const { createHash } = await import("node:crypto");
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(version.checksum);
  await page.goto(path);

  // expire the delivery server-side → the next request shows GALLERY EXPIRED
  await db.delivery.updateMany({ where: { status: "ACTIVE" }, data: { expiresAt: new Date(Date.now() - 1000) } });
  await page.reload();
  await expect(page.getByRole("heading", { name: "GALLERY EXPIRED" })).toBeVisible();
  await expect(page.getByText("This private gallery was available for 48 hours and is no longer accessible.")).toBeVisible();
  await db.$disconnect();
});
