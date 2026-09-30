import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

/**
 * The public showcase (work, services, reviews — no booking, no accounts) and
 * the Superadmin: review moderation, customer → session → delivery, service
 * status, portfolio upload and website text editing reflecting on the site.
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

test("public site: showcase only — no booking, no accounts, no admin link", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("CAPTURED BY THE OCEAN.");
  await expect(page.getByText("MACHINES • MAABAIDHOO • LAAMU").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "EXPLORE OUR WORK" })).toHaveAttribute("href", "/work");
  await expect(page.getByRole("link", { name: /READ REVIEWS/ })).toHaveAttribute("href", "/reviews");
  const html = await page.content();
  expect(html).not.toMatch(/superadmin|register|create account|sign up|book a session/i);
  await page.goto("/services");
  await expect(page.getByRole("heading", { name: "Drone Videography" })).toBeVisible();
  const book = await page.request.get("/book", { maxRedirects: 0 });
  expect(book.status()).toBe(307);
  expect(book.headers()["location"]).toMatch(/\/contact$/);
});

test("guest leaves a review; it appears only after the admin approves it", async ({ page }) => {
  const note = `Unreal drone clips of my waves at Machines ${run}`;
  await page.goto("/reviews");
  await page.getByRole("button", { name: "SEND REVIEW" }).click();
  await expect(page.getByText("Please choose 1 to 5 stars")).toBeVisible();

  await page.getByRole("button", { name: "4 stars" }).click();
  await expect(page.getByText("Great", { exact: true })).toBeVisible();
  await page.getByLabel("Your note").fill(note);
  await page.getByLabel("Your name").fill(`E2E Guest ${run}`);
  await page.getByLabel("Instagram (optional)").fill(`@e2e_${run}`);
  await page.getByRole("button", { name: "SEND REVIEW" }).click();
  await expect(page.getByText(/Thank you! Your review has been sent/)).toBeVisible();

  // not public yet
  await page.goto("/reviews");
  await expect(page.getByText(note)).toHaveCount(0);

  // admin approves + features it
  await login(page);
  await expect(page.getByText("REVIEWS TO APPROVE")).toBeVisible();
  await page.getByRole("link", { name: /^Reviews/ }).first().click();
  const card = page.locator("div.rounded-xl").filter({ hasText: note });
  await expect(card.getByLabel("4 out of 5 stars")).toBeVisible();
  await card.getByRole("button", { name: "Approve" }).click();
  const approved = page.locator("div.rounded-xl").filter({ hasText: note });
  await expect(approved.getByText("On website")).toBeVisible();
  await approved.getByRole("button", { name: /Feature on home/ }).click();
  await expect(page.locator("div.rounded-xl").filter({ hasText: note }).getByRole("button", { name: "★ Featured" })).toBeVisible();

  // public: reviews page + home page, with stars and average
  await page.goto("/reviews");
  const pub = page.locator("figure").filter({ hasText: note });
  await expect(pub).toBeVisible();
  await expect(pub.getByRole("img", { name: "4 out of 5 stars" })).toBeVisible();
  await expect(pub.getByRole("link", { name: `@e2e_${run}` })).toBeVisible();
  await page.goto("/");
  await expect(page.locator("figure").filter({ hasText: note })).toBeVisible();

  // clean up
  await page.goto("/superadmin/testimonials");
  page.once("dialog", (d) => d.accept());
  await page.locator("div.rounded-xl").filter({ hasText: note }).getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText(note)).toHaveCount(0);
});

test("admin: wrong password is rejected", async ({ page }) => {
  await page.goto("/superadmin/login");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill("definitely-wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Incorrect email or password.")).toBeVisible();
});

test("admin: customer → session → delivery", async ({ page }) => {
  await login(page);
  await page.goto("/superadmin/customers/new");
  await page.getByLabel("Name").fill(`E2E Surfer ${run}`);
  await page.getByLabel("Instagram").fill(`e2e_${run}`);
  await page.getByLabel("WhatsApp").fill("+960 777 1234");
  await page.getByRole("button", { name: "Add customer" }).click();
  await expect(page.getByRole("heading", { name: `E2E Surfer ${run}` })).toBeVisible();

  await page.getByRole("link", { name: "New session" }).click();
  await expect(page.getByLabel("Location")).toHaveValue("Machines");
  await page.getByLabel("Date").fill(new Date(Date.now() + 3 * 86400_000).toISOString().slice(0, 10));
  await page.getByLabel("Service").selectOption({ label: "Drone Videography" });
  await page.getByLabel("Price (USD)").fill("180");
  await page.getByLabel("Clips").fill("25");
  await page.getByRole("button", { name: "Create session" }).click();
  await expect(page.getByText("Session created.")).toBeVisible();
  await expect(page.getByRole("heading", { name: /OX-S-\d{5}/ })).toBeVisible();

  await page.getByLabel("Session status").selectOption("COMPLETED");
  await page.getByLabel("Payment").selectOption("PAID");
  await page.getByLabel("Delivery link").fill("https://drive.google.com/drive/folders/example-e2e");
  await page.getByLabel("Delivery status").selectOption("READY");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Session saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("link", { name: "Send via WhatsApp" })).toHaveAttribute("href", /wa\.me\/9607771234.*drive\.google\.com/);
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

test("admin: adding the Instagram username turns on 'Book via Instagram' (DM)", async ({ page, request }) => {
  await login(page);
  await page.goto("/superadmin/content");
  const social = page.locator("form").filter({ has: page.getByRole("button", { name: "Save contact & social" }) });
  await social.getByLabel("Instagram username").fill("@oceanx.e2e");
  await social.getByRole("button", { name: "Save contact & social" }).click();
  await expect(page.getByText("Contact & social saved.")).toBeVisible();

  await page.goto("/");
  await expect(page.locator("header").getByRole("link", { name: /BOOK VIA INSTAGRAM/ })).toHaveAttribute("href", "https://ig.me/m/oceanx.e2e");
  await expect(page.getByRole("link", { name: /DM US TO BOOK/ })).toHaveAttribute("href", "https://ig.me/m/oceanx.e2e");
  const short = await request.get("/book", { maxRedirects: 0 });
  expect(short.headers()["location"]).toBe("https://ig.me/m/oceanx.e2e");

  // restore
  await page.goto("/superadmin/content");
  await social.getByLabel("Instagram username").fill("");
  await social.getByRole("button", { name: "Save contact & social" }).click();
  await expect(page.getByText("Contact & social saved.")).toBeVisible();
  await page.goto("/");
  await expect(page.locator("header").getByRole("link", { name: /BOOK VIA INSTAGRAM/ })).toHaveCount(0);
});

test("admin: logout ends the session", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "Log out" }).first().click();
  await expect(page).toHaveURL(/\/superadmin\/login$/);
  await page.goto("/superadmin/sessions");
  await expect(page).toHaveURL(/\/superadmin\/login$/);
});
