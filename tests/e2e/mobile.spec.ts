import { expect, test } from "@playwright/test";

// Phone layout: no sideways scrolling, menu works, booking form usable.
for (const path of ["/", "/services", "/work", "/machines", "/about", "/contact", "/reviews"]) {
  test(`no horizontal overflow on ${path}`, async ({ page }) => {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

test("mobile menu opens and navigates", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.locator("#mobile-menu").getByRole("link", { name: "Services" }).click();
  await expect(page).toHaveURL(/\/services$/);
});

test("floating review badge appears in the corner after scrolling", async ({ page }) => {
  await page.goto("/services");
  const badge = page.getByRole("link", { name: /Leave a review|Rated .* out of 5/ }).last();
  await page.evaluate(() => window.scrollTo(0, 900));
  await expect(badge).toBeVisible();
  const box = (await badge.boundingBox())!;
  const vp = page.viewportSize()!;
  expect(box.x + box.width).toBeGreaterThan(vp.width - 40); // right corner
  expect(box.y + box.height).toBeGreaterThan(vp.height - 80); // bottom
  await expect(badge).toHaveAttribute("href", /\/reviews/);
});
