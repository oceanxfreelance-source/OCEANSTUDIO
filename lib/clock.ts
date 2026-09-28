/**
 * Server clock. All expiration logic reads time through this module so tests can
 * deterministically "advance time" without touching the system clock.
 */
let offsetMs = 0;

export function now(): Date {
  return new Date(Date.now() + offsetMs);
}

export function advanceClock(ms: number): void {
  if (process.env.NODE_ENV === "production") throw new Error("Clock manipulation is disabled in production");
  offsetMs += ms;
}

export function resetClock(): void {
  offsetMs = 0;
}
