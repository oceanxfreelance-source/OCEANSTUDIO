import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";
import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";

/**
 * The clip shop end to end (server started with STORAGE_DRIVER=local):
 * admin uploads a session → previews → surfer finds a clip, buys it by bank
 * transfer, uploads a slip → admin marks paid → surfer downloads the original.
 * Plus: a booking with clips delivered privately, and "remove my clip".
 */
const EMAIL = process.env.E2E_ADMIN_EMAIL ?? "owner@oceanx.test";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "local-test-password-123";
const run = Date.now().toString(36).slice(-5);
const db = new PrismaClient();
const dir = mkdtempSync(join(tmpdir(), "oxe2e-"));
const created = { clipCodes: [] as string[], orderTokens: [] as string[], bookingTokens: [] as string[] };

function makeClip(name: string, color: string): string {
  const file = join(dir, name);
  const r = spawnSync(ffmpegPath!, ["-y", "-loglevel", "error", "-f", "lavfi", "-i", `color=c=${color}:size=720x1280:rate=30:duration=4`, "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", file]);
  if (r.status !== 0) throw new Error("ffmpeg failed");
  return file;
}

async function login(page: Page) {
  await page.goto("/superadmin/login");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: /Hello/ })).toBeVisible();
}

test.describe.configure({ mode: "serial" });
test.skip(({ browserName }) => browserName !== "chromium");

test.beforeAll(async () => {
  const settings: [string, string][] = [
    ["pay.bankDetails", "OCEAN X PVT LTD\nBank of Maldives\nUSD 7730000000001"],
    ["contact.whatsapp", "+960 7000000"],
  ];
  for (const [key, value] of settings)
    await db.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
});

test.afterAll(async () => {
  await db.order.deleteMany({ where: { token: { in: created.orderTokens } } });
  await db.booking.deleteMany({ where: { token: { in: created.bookingTokens } } });
  await db.clip.deleteMany({ where: { code: { in: created.clipCodes } } });
  await db.removalRequest.deleteMany({ where: { clipCode: { in: created.clipCodes } } });
  await db.setting.deleteMany({ where: { key: { in: ["pay.bankDetails", "contact.whatsapp"] } } });
  await db.$disconnect();
});

test("clip shop: upload a session → buy by bank transfer → download the original", async ({ page, request }) => {
  const original = makeClip("DJI_RED.mp4", "red");
  const other = makeClip("DJI_BLUE.mp4", "blue");

  // Admin uploads a session of two clips.
  await login(page);
  await page.goto("/superadmin/clips/upload");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose clips" }).click();
  await (await chooser).setFiles([original, other]);
  await expect(page.getByText("✓ Ready")).toHaveCount(2, { timeout: 60_000 });
  const codes = await page.locator("li span.font-mono").allTextContents();
  expect(codes).toHaveLength(2);
  expect(codes[0]).toMatch(/^MC-\d{4}-\d{2}$/);
  created.clipCodes.push(...codes);
  await page.getByLabel(`Surfer description for ${codes[0]}`).fill(`red board e2e${run}`);
  await page.getByLabel(`Surfer description for ${codes[1]}`).fill(`blue board e2e${run}`);
  await page.getByLabel(`Surfer description for ${codes[1]}`).blur();
  await expect.poll(async () => (await db.clip.findUnique({ where: { code: codes[1]! } }))?.description).toBe(`blue board e2e${run}`);

  // The surfer finds their clip by board colour. Originals never appear publicly.
  await page.context().clearCookies();
  await page.goto(`/clips?q=red+board+e2e${run}`);
  await expect(page.getByText(/^1 result for/)).toBeVisible();
  const html = await page.content();
  const clip = await db.clip.findUniqueOrThrow({ where: { code: codes[0]! } });
  expect(html).not.toContain(clip.originalKey);
  await page.getByRole("button", { name: `Play preview of clip ${codes[0]}` }).click();
  await expect(page.getByLabel(`Preview of clip ${codes[0]}`)).toBeVisible();
  await page.getByRole("button", { name: /ADD — THIS IS ME/ }).click();
  await expect(page.getByRole("link", { name: "CHECKOUT →" })).toBeVisible();
  await page.getByRole("link", { name: "CHECKOUT →" }).click();

  await expect(page.getByRole("heading", { name: "Your clips" })).toBeVisible();
  await page.getByLabel("Your name").fill(`E2E Surfer ${run}`);
  await page.getByLabel("WhatsApp number").fill("+44 7700 900123");
  await page.getByText("Bank transfer (you or your guide)").click();
  await expect(page.getByText("USD 7730000000001")).toBeVisible();
  await page.getByRole("button", { name: /PLACE ORDER · \$20/ }).click();
  await expect(page).toHaveURL(/\/order\/[A-Za-z0-9_-]+\?new=1$/);
  const token = page.url().split("/order/")[1]!.split("?")[0]!;
  created.orderTokens.push(token);
  await expect(page.getByRole("heading", { name: "Almost there." })).toBeVisible();
  await expect(page.getByRole("link", { name: "SEND ON WHATSAPP" })).toHaveAttribute("href", /wa\.me\/9607000000\?text=.*OX-O-/);

  // Before payment the original can't be downloaded.
  const blocked = await request.get(`/api/download/${token}/${clip.id}`, { maxRedirects: 0 });
  expect(blocked.status()).toBe(403);

  // Slip upload (photo).
  const slip = join(dir, "slip.png");
  await sharp({ create: { width: 600, height: 900, channels: 3, background: "#ffffff" } }).png().toFile(slip);
  const slipChooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "UPLOAD PAYMENT SLIP" }).click();
  await (await slipChooser).setFiles(slip);
  await expect(page.getByText(/Slip received/)).toBeVisible();

  // Admin sees the order with the slip and marks it paid.
  await login(page);
  await page.goto("/superadmin/orders");
  await page.getByRole("link", { name: new RegExp(`E2E Surfer ${run}`) }).click();
  const slipLink = page.getByRole("link", { name: /Slip photo/ });
  const slipRes = await request.get((await slipLink.getAttribute("href"))!, { headers: { cookie: (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join("; ") } });
  expect(slipRes.headers()["content-type"]).toBe("image/jpeg");
  await page.getByRole("button", { name: "Mark paid — open downloads" }).click();
  await expect(page.getByText("Delivered", { exact: true })).toBeVisible();

  // The surfer downloads the full-quality original — byte for byte.
  await page.goto(`/order/${token}`);
  await expect(page.getByRole("heading", { name: "Your clips are ready." })).toBeVisible();
  const dl = await request.get(`/api/download/${token}/${clip.id}`);
  expect(dl.status()).toBe(200);
  expect((await dl.body()).equals(readFileSync(original))).toBe(true);
  expect(statSync(original).size).toBeGreaterThan(1000);
});

test("bookings: request → confirm → clips go privately to the surfer → paid → download", async ({ page, request }) => {
  await page.goto("/book");
  await page.getByRole("button", { name: /Morning$/ }).first().click();
  await page.getByLabel("How do we recognise you?").fill(`yellow board e2e${run}, shout BOB`);
  await page.getByLabel("Your name").fill(`E2E Booker ${run}`);
  await page.getByLabel("WhatsApp number").fill("+44 7700 900456");
  await page.getByRole("button", { name: "REQUEST BOOKING" }).click();
  await expect(page).toHaveURL(/\/booking\/[A-Za-z0-9_-]+\?new=1$/);
  const token = page.url().split("/booking/")[1]!.split("?")[0]!;
  created.bookingTokens.push(token);
  await expect(page.getByRole("heading", { name: "Requested" })).toBeVisible();
  await expect(page.getByText("Deposit to pay now")).toBeVisible();

  await login(page);
  await page.goto("/superadmin/bookings?view=requests");
  await page.getByRole("link", { name: new RegExp(`E2E Booker ${run}`) }).click();
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Confirmed", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Deposit received/ }).click();
  await expect(page.getByText("Deposit paid", { exact: true })).toBeVisible();

  // Upload a clip straight to this booking.
  await page.getByRole("link", { name: "+ Upload clips for this booking" }).click();
  await expect(page.getByLabel("These clips are for")).toHaveValue(/.+/);
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose clips" }).click();
  await (await chooser).setFiles(makeClip("DJI_YELLOW.mp4", "yellow"));
  await expect(page.getByText("✓ Ready")).toHaveCount(1, { timeout: 60_000 });
  const code = (await page.locator("li span.font-mono").first().textContent())!;
  created.clipCodes.push(code);
  const clip = await db.clip.findUniqueOrThrow({ where: { code } });
  expect(clip.bookingId).not.toBeNull();

  // Booked clips stay out of the public gallery.
  const gallery = await request.get(`/clips?q=${code}`);
  expect(await gallery.text()).toContain("No clips match yet.");

  await page.goBack();
  await page.reload();
  await page.getByRole("button", { name: "Clips ready — show them" }).click();
  await expect(page.getByText("Ready to download", { exact: true })).toBeVisible();
  await page.goto(`/booking/${token}`);
  await expect(page.getByText(/Downloads of the full-quality clips open as soon as the balance is paid/)).toBeVisible();
  expect((await request.get(`/api/download/${token}/${clip.id}`, { maxRedirects: 0 })).status()).toBe(403);

  await page.goBack();
  await page.getByRole("button", { name: /Balance received/ }).click();
  await expect(page.getByText("Paid", { exact: true })).toBeVisible();
  await page.goto(`/booking/${token}`);
  await expect(page.getByRole("heading", { name: "Your clips are ready." })).toBeVisible();
  expect((await request.get(`/api/download/${token}/${clip.id}`)).status()).toBe(200);
});

test("privacy: 'remove my clip' takes it out of the gallery at once", async ({ page }) => {
  const code = created.clipCodes[1]!;
  await page.goto(`/clips?q=${code}`);
  await expect(page.getByText(/^1 result for/)).toBeVisible();
  await page.getByRole("link", { name: "Remove my clip" }).first().click();
  await expect(page).toHaveURL(/\/remove$/);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Clip code").fill(code.toLowerCase());
  await expect(page.getByLabel("Clip code")).toHaveValue(code.toLowerCase());
  await page.getByLabel(/Reason/).fill("It's me, please remove");
  await page.getByRole("button", { name: "REMOVE MY CLIP" }).click();
  await expect(page.getByText(/taken out of the gallery/)).toBeVisible();
  await page.goto(`/clips?q=${code}`);
  await expect(page.getByText("No clips match yet.")).toBeVisible();

  await login(page);
  await page.goto("/superadmin/removals");
  await expect(page.getByText("It's me, please remove")).toBeVisible();
});

test("storage: old unsold clips are deleted; ordered and booked ones are kept", async ({ request }) => {
  const mc = await db.location.findFirst({ where: { code: "MC" } });
  const old = new Date(Date.now() - 30 * 3600_000);
  const day = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
  const mk = (code: string, extra: object = {}) =>
    db.clip.create({ data: { code, date: day, slot: "MORNING", locationId: mc!.id, originalKey: `clips/${code}.mp4`, status: "READY", createdAt: old, ...extra } });
  const unsold = await mk(`MC-CLN-${run}A`);
  const fresh = await mk(`MC-CLN-${run}B`, { createdAt: new Date() });
  const ordered = await mk(`MC-CLN-${run}C`);
  const customer = await db.customer.create({ data: { name: "Cleanup test" } });
  const booking = await db.booking.create({ data: { reference: `OX-B-CLN${run}`, token: `cleanupbooking${run}xxxxxxx`, customerId: customer.id, fullName: "Cleanup test", status: "CONFIRMED" } });
  const booked = await mk(`MC-CLN-${run}D`, { bookingId: booking.id });
  const order = await db.order.create({
    data: {
      reference: `OX-O-CLN${run}`,
      token: `cleanuporder${run}xxxxxxxxx`,
      name: "Cleanup test",
      paymentMethod: "CASH",
      total: 20,
      sessions: { create: { date: day, slot: "MORNING", package: "CLIPS", price: 20, items: { create: { clipId: ordered.id, clipCode: ordered.code } } } },
    },
  });
  try {
    expect((await request.get("/api/cron/cleanup")).status()).toBe(401);
    const res = await request.get("/api/cron/cleanup", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
    expect(res.status()).toBe(200);
    const left = (await db.clip.findMany({ where: { code: { startsWith: `MC-CLN-${run}` } }, select: { code: true } })).map((c) => c.code).sort();
    expect(left).toEqual([fresh.code, ordered.code, booked.code].sort());
    expect(await db.clip.findUnique({ where: { id: unsold.id } })).toBeNull();
  } finally {
    await db.order.delete({ where: { id: order.id } });
    await db.clip.deleteMany({ where: { code: { startsWith: `MC-CLN-${run}` } } });
    await db.booking.delete({ where: { id: booking.id } });
    await db.customer.delete({ where: { id: customer.id } });
  }
});

test("admin: change the clip price on Prices & payment; the shop uses it", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "Prices & payment" }).first().click();
  await page.getByLabel("Price per clip (USD)").fill("$25");
  await page.getByRole("button", { name: "Save prices" }).click();
  await expect(page.getByText(/prices saved/i)).toBeVisible();
  await page.goto("/clips");
  await expect(page.getByText("$25 a clip", { exact: false })).toBeVisible();
  // bad input is refused, then restore
  await page.goto("/superadmin/prices");
  await page.getByLabel("Price per clip (USD)").fill("twenty");
  await page.getByRole("button", { name: "Save prices" }).click();
  await expect(page.getByText("Enter a number, e.g. 20")).toBeVisible();
  await page.getByLabel("Price per clip (USD)").fill("20");
  await page.getByRole("button", { name: "Save prices" }).click();
  await expect(page.getByText(/prices saved/i)).toBeVisible();
});

test("bank transfer also explains paying through your guide, with 'send this page to my guide'", async ({ page }) => {
  const mc = await db.location.findFirst({ where: { code: "MC" } });
  const clip = await db.clip.create({
    data: { code: `MC-GDE-${run}`, date: new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z"), slot: "MIDDAY", locationId: mc!.id, originalKey: "clips/none", status: "READY", description: `guide test ${run}` },
  });
  created.clipCodes.push(clip.code);
  await page.goto(`/clips?q=${clip.code}`);
  await page.getByRole("button", { name: /ADD — THIS IS ME/ }).click();
  await page.getByRole("link", { name: "CHECKOUT →" }).click();
  await expect(page.getByText("Pay through my guide")).toHaveCount(0);
  await page.getByLabel("Your name").fill(`E2E Guide ${run}`);
  await page.getByLabel("WhatsApp number").fill("+44 7700 900789");
  await page.getByText("Bank transfer (you or your guide)").click();
  await expect(page.getByText(/or give the cash to your guide/)).toBeVisible();
  await page.getByRole("button", { name: /PLACE ORDER/ }).click();
  await expect(page).toHaveURL(/\/order\/[A-Za-z0-9_-]+\?new=1$/);
  created.orderTokens.push(page.url().split("/order/")[1]!.split("?")[0]!);
  await expect(page.getByText(/give the cash to your guide and send them this page/)).toBeVisible();
  await expect(page.getByRole("button", { name: "UPLOAD PAYMENT SLIP" })).toBeVisible();
  await expect(page.getByRole("link", { name: "SEND THIS PAGE TO MY GUIDE" })).toHaveAttribute("href", /wa\.me\/\?text=.*order%2F/);
  const order = await db.order.findUniqueOrThrow({ where: { token: created.orderTokens.at(-1)! } });
  expect(order.paymentMethod).toBe("BANK_TRANSFER");
});
