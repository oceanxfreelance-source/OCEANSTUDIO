import { expect, test } from "@playwright/test";

/**
 * The hero's camera viewfinder (REC, timecode, readouts, crosshair) must never
 * sit on top of the headline, subtitle or buttons — on any common screen size.
 */
const SIZES = [
  [1280, 600], [1366, 768], [1440, 700], [1440, 900], [1920, 1080],
  [1024, 560], [1024, 1366], [844, 390], [390, 844], [360, 640],
] as const;

for (const [width, height] of SIZES) {
  test(`hero viewfinder doesn't overlap text at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await page.waitForTimeout(2600); // let the entrance animation finish
    const overlap = await page.evaluate(() => {
      const shown = (e: Element) => (e as HTMLElement).offsetParent !== null && e.getBoundingClientRect().width > 0;
      const overlay = [...document.querySelectorAll(".vf-frame span")].filter((e) => e.textContent?.trim() && shown(e));
      const cross = document.querySelector(".vf-cross");
      if (cross && shown(cross)) overlay.push(cross);
      const text = [...document.querySelectorAll(".hero-content-scroll p, .hero-content-scroll h1, .hero-content-scroll a")];
      const hit = (a: DOMRect, b: DOMRect) => !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
      for (const o of overlay)
        for (const t of text) if (hit(o.getBoundingClientRect(), t.getBoundingClientRect())) return `${o.textContent?.trim() || "crosshair"} ↔ ${t.textContent?.slice(0, 24)}`;
      return null;
    });
    expect(overlap).toBeNull();
  });
}
