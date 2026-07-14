import { describe, expect, it } from "vitest";
import type { PrivateLiveState } from "../shared/types.js";
import { d20ModeDisabledReason } from "../src/d20Availability.js";

const valid = {
  status: "in_progress",
  control: {
    role: "controller",
    controllerConnected: true,
    audienceCount: 1,
  },
  d20Settings: { enabled: true },
  d20Private: null,
  activeQuestion: null,
  hasActiveD20Modifier: false,
} as unknown as PrivateLiveState;

describe("D20 mode availability", () => {
  it("allows Question Selector mode under valid idle host conditions", () => {
    expect(d20ModeDisabledReason(valid)).toBeNull();
  });

  it.each([
    [
      "observers",
      { control: { ...valid.control, role: "observer" } },
      /holding control/,
    ],
    ["completed episodes", { status: "completed" }, /in-progress episode/],
    ["active rolls", { d20Private: { id: "roll" } }, /roll is active/],
    [
      "active modifiers",
      { hasActiveD20Modifier: true },
      /active D20 modifier/,
    ],
  ])("keeps mode disabled for %s", (_name, patch, message) => {
    const state = {
      ...valid,
      ...patch,
    } as unknown as PrivateLiveState;
    expect(d20ModeDisabledReason(state)).toMatch(message as RegExp);
  });
});
