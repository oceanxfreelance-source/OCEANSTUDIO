"use client";

import { useEffect } from "react";

const SELECTOR = "[data-reveal]:not(.is-visible), [data-reveal-image]:not(.is-visible)";

/**
 * One IntersectionObserver for the whole page: elements with `data-reveal`
 * (fade/rise) or `data-reveal-image` (image wipe) animate in when they scroll
 * into view. Elements arriving together (e.g. a row of cards) are staggered
 * automatically. Without JS everything is simply visible.
 */
export function RevealObserver() {
  useEffect(() => {
    const els = () => document.querySelectorAll<HTMLElement>(SELECTOR);
    if (!("IntersectionObserver" in window)) {
      els().forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        const shown = entries.filter((e) => e.isIntersecting).map((e) => e.target as HTMLElement);
        // Stagger left-to-right, top-to-bottom.
        shown.sort((a, b) => {
          const ra = a.getBoundingClientRect();
          const rb = b.getBoundingClientRect();
          return Math.abs(ra.top - rb.top) > 40 ? ra.top - rb.top : ra.left - rb.left;
        });
        shown.forEach((el, i) => {
          if (!el.style.getPropertyValue("--reveal-delay")) el.style.setProperty("--reveal-delay", `${Math.min(i, 6) * 90}ms`);
          el.classList.add("is-visible");
          io.unobserve(el);
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.12 },
    );
    const observe = () => els().forEach((el) => io.observe(el));
    observe();
    // Pick up content rendered after client-side navigation.
    const mo = new MutationObserver(observe);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);
  return null;
}
