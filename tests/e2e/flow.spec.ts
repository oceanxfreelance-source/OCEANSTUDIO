import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

/**
 * The whole business flow, as a visitor and as the Superadmin:
 * visitor books (no account) → admin logs in → sees the request → creates a
 * session → adds a delivery link → marks it sent; plus service status,
 * portfolio upload and website text editing reflecting on the public site.
 */
const EMAIL = process.env.E2E_ADMIN_EMAIL ?? "owner@oceanx.test";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "local-test-password-123";
const run = Date.now().toString(36);

test.describe.configure({ mode: "serial" });
test.skip(({ browserName }) => browserName !== "chromium");

async function login(page: Page) {
  await page.goto("/superadmin");
  await expect(page).toHaveURL(/\/superadmin\/login$/);
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: /Hello/ })).toBeVisible();
}

test("public site: no accounts, no admin link", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("CAPTURED BY THE OCEAN.");
  await expect(page.getByText("MACHINES • MAABAIDHOO • LAAMU").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "BOOK A SESSION" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /EXPLORE OUR WORK/ })).toBeVisible();
  const html = await page.content();
  expect(html).not.toMatch(/superadmin|register|create account|sign up/i);
  await page.goto("/services");
  await expect(page.getByRole("heading", { name: "Drone Videography" })).toBeVisible();
});

test("visitor sends a booking request without an account", async ({ page }) => {
  await page.goto("/book");
  await page.getByRole("button", { name: "SEND REQUEST" }).click();
  await expect(page.getByText("Please enter your name")).toBeVisible();

  await page.getByLabel("Full name").fill(`E2E Surfer ${run}`);
  await page.getByLabel("Instagram username").fill(`@e2e_${run}`);
  await page.getByLabel("WhatsApp").fill("+960 777 1234");
  const d = new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10);
  await page.getByLabel("Preferred date").fill(d);
  await page.getByLabel("Preferred time").selectOption("Sunrise");
  await page.getByLabel("Number of surfers").fill("2");
  await page.getByLabel("Service").selectOption({ label: "Drone Videography" });
  await page.getByLabel("Location").selectOption("Machines");
  await page.getByLabel("Message").fill("Two of us surfing Machines, would love drone clips.");
  await page.getByRole("button", { name: "SEND REQUEST" }).click();
  await expect(page.getByText("Thanks for reaching out to Ocean X. We'll get back to you shortly.")).toBeVisible();
  await expect(page.getByText(/OX-B-\d{5}/)).toBeVisible();
});

test("admin: wrong password is rejected", async ({ page }) => {
  await page.goto("/superadmin/login");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill("definitely-wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Incorrect email or password.")).toBeVisible();
});

test("admin: booking → session → delivery", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: /Bookings/ }).first().click();
  await expect(page.getByRole("heading", { name: "Bookings", exact: true })).toBeVisible();
  await page.getByRole("link", { name: `E2E Surfer ${run}`, exact: true }).click();
  await expect(page.getByText("Two of us surfing Machines")).toBeVisible();
  await expect(page.getByText("@e2e_" + run).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Reply on WhatsApp" })).toHaveAttribute("href", /wa\.me\/9607771234/);

  await page.getByRole("link", { name: "Create session" }).first().click();
  await expect(page.getByLabel("Location")).toHaveValue("Machines");
  await page.getByLabel("Price (USD)").fill("180");
  await page.getByLabel("Clips").fill("25");
  await page.getByRole("button", { name: "Create session" }).click();
  await expect(page.getByText("Session created.")).toBeVisible();
  await expect(page.getByRole("heading", { name: /OX-S-\d{5}/ })).toBeVisible();

  // booking is now confirmed
  await page.getByRole("link", { name: /Booking OX-B/ }).click();
  await expect(page.getByText("Confirmed").first()).toBeVisible();
  await page.goBack();

  // complete + deliver
  await page.getByLabel("Session status").selectOption("COMPLETED");
  await page.getByLabel("Payment").selectOption("PAID");
  await page.getByLabel("Delivery link").fill("https://drive.google.com/drive/folders/example-e2e");
  await page.getByLabel("Delivery status").selectOption("READY");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Session saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("link", { name: "Send via WhatsApp" })).toHaveAttribute("href", /drive\.google\.com/);
  await page.getByRole("button", { name: "Mark as sent" }).click();
  await expect(page.getByText(/Marked as sent/)).toBeVisible();
});

test("admin: switching a service to Active updates the public site", async ({ page }) => {
  await login(page);
  await page.goto("/superadmin/services");
  const row = page.getByRole("row", { name: /Sea Photography/ });
  await row.getByRole("button", { name: "→ Active" }).click();
  await expect(row.getByText("Active", { exact: true })).toBeVisible();
  await page.goto("/services");
  const available = page.locator("section").filter({ hasText: "Available now" });
  await expect(available.getByRole("heading", { name: "Sea Photography" })).toBeVisible();
  // put it back
  await page.goto("/superadmin/services");
  await page.getByRole("row", { name: /Sea Photography/ }).getByRole("button", { name: "→ Coming soon" }).click();
  await expect(page.getByRole("row", { name: /Sea Photography/ }).getByText("Coming soon", { exact: true })).toBeVisible();
});

test("admin: portfolio item with uploaded photo appears on Our Work", async ({ page }) => {
  await login(page);
  await page.goto("/superadmin/portfolio/new");
  await page.getByLabel("Title").fill(`E2E Glass ${run}`);
  await page.getByLabel("Category").selectOption("Surf");
  await page.getByLabel("Location").selectOption({ label: "Machines" });
  const jpeg = await sharp({ create: { width: 1600, height: 1000, channels: 3, background: "#2f7f86" } }).jpeg().toBuffer();
  await page.locator('input[type="file"][accept="image/*"]').first().setInputFiles({ name: "wave.jpg", mimeType: "image/jpeg", buffer: jpeg });
  await expect(page.locator('img[src*="/media/"]').first()).toBeVisible();
  await page.getByRole("button", { name: "Add to portfolio" }).click();
  await expect(page.getByText("Added to the portfolio.")).toBeVisible();

  await page.goto("/work?category=surf");
  await page.getByRole("link", { name: new RegExp(`E2E Glass ${run}`) }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`E2E Glass ${run}`);
  const src = await page.locator("article img").first().getAttribute("src");
  const res = await page.request.get(src!);
  expect(res.headers()["content-type"]).toBe("image/webp");

  // clean up
  await page.goto("/superadmin/portfolio");
  await page.getByRole("link", { name: `E2E Glass ${run}` }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL(/\/superadmin\/portfolio$/);
});

test("admin: video upload is offered from the gallery and locked to admins", async ({ page, request }) => {
  // Without a session the upload endpoint refuses to issue upload permission.
  const anon = await request.post("/api/admin/video-upload", { data: {}, maxRedirects: 0, headers: { cookie: "ox_admin=forged" } });
  expect(anon.status()).toBe(401);

  await login(page);
  await page.goto("/superadmin/portfolio/new");
  const upload = page.getByRole("button", { name: "Upload video" });
  await expect(upload).toBeVisible();
  await expect(page.locator('input[type="file"][accept="video/*"]')).toHaveCount(1);
  const chooser = page.waitForEvent("filechooser");
  await upload.click();
  expect((await chooser).isMultiple()).toBe(false);
});

test("admin: editing website text changes the home page", async ({ page }) => {
  await login(page);
  await page.goto("/superadmin/content");
  const hero = page.locator("form").filter({ hasText: "Hero title" });
  await hero.getByLabel("Hero title").fill(`E2E TITLE ${run}`);
  await hero.getByRole("button", { name: /Save/ }).click();
  await expect(page.getByText("Home — hero saved.")).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`E2E TITLE ${run}`);
  // restore
  await page.goto("/superadmin/content");
  await hero.getByLabel("Hero title").fill("CAPTURED BY THE OCEAN.");
  await hero.getByRole("button", { name: /Save/ }).click();
  await expect(page.getByText("Home — hero saved.")).toBeVisible();
});

test("admin: logout ends the session", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "Log out" }).first().click();
  await expect(page).toHaveURL(/\/superadmin\/login$/);
  await page.goto("/superadmin/bookings");
  await expect(page).toHaveURL(/\/superadmin\/login$/);
});
