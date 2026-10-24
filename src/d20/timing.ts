export const landingGlowMs = 1500;
export const resultRevealDelayMs = 500;
export function elapsedRollMs(rolledAt: string, durationMs: number, now = Date.now()) {
  const start = Date.parse(rolledAt);
  return Number.isFinite(start) ? Math.max(0, now - start) : Math.max(0, durationMs) + landingGlowMs;
}
export function landingGlowStrength(ageMs: number) {
  if (ageMs < 0 || ageMs >= landingGlowMs) return 0;
  if (ageMs < 120) return ageMs / 120;
  return ageMs < 450 ? 1 : Math.pow((landingGlowMs - ageMs) / 1050, 1.7);
}
