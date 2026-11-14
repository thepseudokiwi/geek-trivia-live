// Question selectors keep the board on air for five seconds after the die lands.
export const questionSelectorHoldMs = 5000;
export const xpTileFlipMs = 1450;

export function xpTileFlipStartMs(rollDurationMs: number) {
  // Let the flipped tile rest briefly before the server switches to question.
  return rollDurationMs + questionSelectorHoldMs - xpTileFlipMs - 150;
}
