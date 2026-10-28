"use client";

import { useEffect } from "react";

/** Links like /?ref=guesthouse-name remember the partner for 30 days (stored on orders and bookings). */
export function RefCapture() {
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref && /^[a-z0-9-]{2,40}$/i.test(ref)) document.cookie = `ox_ref=${ref.toLowerCase()}; path=/; max-age=${30 * 86400}; samesite=lax`;
  }, []);
  return null;
}
