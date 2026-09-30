import { expect, test } from "@playwright/test";

// Phone layout: no sideways scrolling, menu works, booking form usable.
for (const path of ["/", "/services", "/work", "/machines", "/about", "/contact", "/book"]) {
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
