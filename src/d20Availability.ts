import type { PrivateLiveState } from "../shared/types.js";

export function d20ModeDisabledReason(
  state: Pick<
    PrivateLiveState,
    | "status"
    | "control"
    | "d20Settings"
    | "d20Private"
    | "activeQuestion"
    | "hasActiveD20Modifier"
  >,
): string | null {
  if (state.control.role !== "controller")
    return "Only the Host Console holding control can change D20 mode.";
  if (state.status !== "in_progress")
    return "D20 mode can only be changed during an in-progress episode.";
  if (!state.d20Settings.enabled)
    return "Enable the D20 system in D20 settings before changing mode.";
  if (state.d20Private)
    return "A D20 roll is active. Acknowledge, apply, cancel, or undo it first.";
  if (state.activeQuestion)
    return "Finish or skip the active question before changing D20 mode.";
  if (state.hasActiveD20Modifier)
    return "Finish or skip the question using the active D20 modifier first.";
  return null;
}
