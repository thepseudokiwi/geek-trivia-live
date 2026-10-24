import { parseUtcTimestamp } from '../../shared/timestamps.js';

export const landingGlowMs = 1500;
export const resultRevealDelayMs = 500;
export function elapsedRollMs(rolledAt: string, durationMs: number, now = Date.now()) {
  const start = parseUtcTimestamp(rolledAt);
  return Number.isFinite(start) ? Math.max(0, now - start) : Math.max(0, durationMs) + landingGlowMs;
}

// Anchor once to the server snapshot, then advance on a monotonic local clock.
// Local timezone, wall-clock skew, and later system-clock changes cannot freeze
// a live roll or make a refreshed old roll replay its landing sequence.
export function createRollClock(rolledAt: string, durationMs: number, serverNow?: string,
  monotonicNow:()=>number=()=>performance.now(), wallNow=Date.now()) {
  const serverTime=serverNow?parseUtcTimestamp(serverNow):NaN;
  const initialElapsed=elapsedRollMs(rolledAt,durationMs,Number.isFinite(serverTime)?serverTime:wallNow);
  const anchor=monotonicNow();
  return ()=>initialElapsed+Math.max(0,monotonicNow()-anchor);
}
export function landingGlowStrength(ageMs: number) {
  if (ageMs < 0 || ageMs >= landingGlowMs) return 0;
  if (ageMs < 120) return ageMs / 120;
  return ageMs < 450 ? 1 : Math.pow((landingGlowMs - ageMs) / 1050, 1.7);
}
