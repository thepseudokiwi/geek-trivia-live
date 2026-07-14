import { useState } from "react";
import type {
  D20Mode,
  D20Effect,
  D20Settings,
  PrivateLiveState,
} from "../../shared/types";
export function D20Panel({
  state,
  disabled,
  send,
}: {
  state: PrivateLiveState;
  disabled: boolean;
  send: (type: any, payload?: Record<string, unknown>) => void;
}) {
  const [currentMode, setCurrentMode] = useState<D20Mode>(
      state.d20Settings.mode,
    ),
    [editing, setEditing] = useState(false),
    [settings, setSettings] = useState<D20Settings>(state.d20Settings);
  const roll = state.d20Private,
    latest = state.d20History[0];
  const updateEffect = (index: number, patch: Partial<D20Effect>) =>
    setSettings({
      ...settings,
      effects: settings.effects.map((effect, i) =>
        i === index ? { ...effect, ...patch } : effect,
      ),
    });
  const save = async () => {
    const response = await fetch(`/api/episodes/${state.episodeId}/d20`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    if (response.ok) location.reload();
    else alert((await response.json()).error);
  };
  const changeMode = async (mode: D20Mode) => {
    setCurrentMode(mode);
    const response = await fetch(`/api/episodes/${state.episodeId}/d20`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    if (response.ok) location.reload();
  };
  return (
    <section className="d20-panel">
      <div className="d20-heading">
        <div>
          <p className="eyebrow">Server-authoritative</p>
          <h2>D20 System</h2>
        </div>
        <button className="secondary" onClick={() => setEditing((x) => !x)}>
          D20 settings
        </button>
      </div>
      <label>
        Mode{" "}
        <select
          disabled={disabled || Boolean(roll) || Boolean(state.activeQuestion)}
          value={currentMode}
          onChange={(e) => void changeMode(e.target.value as D20Mode)}
        >
          <option value="question_selector">Question Selector</option>
          <option value="event_die">Event Die</option>
          <option value="manual">Manual / Off</option>
        </select>
      </label>
      <button
        className="d20-roll-button"
        disabled={
          disabled ||
          currentMode === "manual" ||
          Boolean(roll) ||
          (currentMode === "question_selector" &&
            Boolean(state.activeQuestion)) ||
          (currentMode === "event_die" && !state.activeQuestion)
        }
        onClick={() => send("d20.roll", { mode: currentMode })}
      >
        Roll D20
      </button>
      {!roll && latest?.status === "applied" && (
        <button
          className="secondary"
          disabled={disabled}
          onClick={() =>
            confirm(
              "Undo the latest applied D20 modifier? Viewers may already have seen it.",
            ) && send("d20.undo")
          }
        >
          Undo applied D20
        </button>
      )}
      {roll && (
        <div className="d20-result-private" aria-live="polite">
          <strong className="d20-number">{roll.result}</strong>
          <div>
            <h3>{roll.effectName}</h3>
            <p>{roll.privateInstructions}</p>
            {roll.selectedSquare && (
              <p>
                <strong>Selected:</strong> {roll.selectedSquare.category} ·{" "}
                {roll.selectedSquare.value} XP
              </p>
            )}
            <p>
              <strong>Correct award:</strong> {roll.effectiveAwardXp} XP ·{" "}
              <strong>Deduction:</strong> {roll.effectiveDeductionXp} XP
            </p>
            {roll.timerOverrideMs && (
              <p>Timer override: {roll.timerOverrideMs / 1000}s</p>
            )}
            {roll.stealEnabled && <p>Steal workflow enabled.</p>}
            <p>Status: {roll.status}</p>
          </div>
          <div className="actions">
            <button
              disabled={disabled || !roll.canApply}
              onClick={() =>
                send(
                  roll.mode === "question_selector"
                    ? "d20.acknowledge"
                    : "d20.apply",
                )
              }
            >
              {roll.mode === "question_selector"
                ? "Acknowledge"
                : "Apply modifier"}
            </button>
            <button
              disabled={disabled || !roll.canCancel}
              className="secondary"
              onClick={() =>
                confirm("Cancel this persisted D20 result?") &&
                send("d20.cancel", { reason: "Host cancelled" })
              }
            >
              Cancel
            </button>
            <button
              disabled={disabled || !roll.canUndo}
              className="secondary"
              onClick={() =>
                confirm(
                  "Undo this D20 roll? Viewers may already have seen it.",
                ) && send("d20.undo")
              }
            >
              Undo roll
            </button>
          </div>
        </div>
      )}
      {editing && (
        <div className="d20-settings">
          <label>
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) =>
                setSettings({ ...settings, enabled: e.target.checked })
              }
            />{" "}
            D20 enabled
          </label>
          <label>
            Theme{" "}
            <select
              value={settings.theme}
              onChange={(e) =>
                setSettings({ ...settings, theme: e.target.value as any })
              }
            >
              <option value="neon_arcane">Neon Arcane</option>
              <option value="classic_polyhedral">Classic Polyhedral</option>
              <option value="holographic_scifi">Holographic Sci-Fi</option>
            </select>
          </label>
          <label>
            Animation ms{" "}
            <input
              type="number"
              value={settings.animationDurationMs}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  animationDurationMs: Number(e.target.value),
                })
              }
            />
          </label>
          <label>
            Reduced-motion ms{" "}
            <input
              type="number"
              value={settings.reducedMotionDurationMs}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  reducedMotionDurationMs: Number(e.target.value),
                })
              }
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.modifiersAffectDeductions}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  modifiersAffectDeductions: e.target.checked,
                })
              }
            />{" "}
            Modifiers affect deductions
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.skippedEligible}
              onChange={(e) =>
                setSettings({ ...settings, skippedEligible: e.target.checked })
              }
            />{" "}
            Skipped squares eligible
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.autoShowPublic}
              onChange={(e) =>
                setSettings({ ...settings, autoShowPublic: e.target.checked })
              }
            />{" "}
            Show result publicly
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.autoReturn}
              onChange={(e) =>
                setSettings({ ...settings, autoReturn: e.target.checked })
              }
            />{" "}
            Return after result
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.autoSelectQuestion}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  autoSelectQuestion: e.target.checked,
                })
              }
            />{" "}
            Select result question
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.requireConfirmation}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  requireConfirmation: e.target.checked,
                })
              }
            />{" "}
            Require apply confirmation
          </label>
          <label>
            Speed seconds{" "}
            <input
              type="number"
              min="1"
              value={settings.speedDurationMs / 1000}
              onChange={(e) => {
                const duration = Number(e.target.value) * 1000;
                setSettings({
                  ...settings,
                  speedDurationMs: duration,
                  effects: settings.effects.map((x) =>
                    x.key === "speed" ? { ...x, timerOverrideMs: duration } : x,
                  ),
                });
              }}
            />
          </label>
          <label>
            Result display ms{" "}
            <input
              type="number"
              min="0"
              value={settings.resultDisplayDurationMs}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  resultDisplayDurationMs: Number(e.target.value),
                })
              }
            />
          </label>
          <label>
            Critical failure consequence{" "}
            <input
              value={settings.criticalFailureConsequence}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  criticalFailureConsequence: e.target.value,
                })
              }
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.soundEnabled}
              onChange={(e) =>
                setSettings({ ...settings, soundEnabled: e.target.checked })
              }
            />{" "}
            Generated sound cues
          </label>
          <label>
            Volume{" "}
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.volume}
              onChange={(e) =>
                setSettings({ ...settings, volume: Number(e.target.value) })
              }
            />
          </label>
          <h3>Rule table</h3>
          {settings.effects.map((effect, i) => (
            <div className="effect-editor" key={effect.key}>
              <input
                aria-label={`${effect.name} name`}
                value={effect.name}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    effects: settings.effects.map((x, j) =>
                      j === i ? { ...x, name: e.target.value } : x,
                    ),
                  })
                }
              />
              <input
                aria-label={`${effect.name} minimum`}
                type="number"
                min="1"
                max="20"
                value={effect.minRoll}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    effects: settings.effects.map((x, j) =>
                      j === i ? { ...x, minRoll: Number(e.target.value) } : x,
                    ),
                  })
                }
              />
              <span>–</span>
              <input
                aria-label={`${effect.name} maximum`}
                type="number"
                min="1"
                max="20"
                value={effect.maxRoll}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    effects: settings.effects.map((x, j) =>
                      j === i ? { ...x, maxRoll: Number(e.target.value) } : x,
                    ),
                  })
                }
              />
              <input
                aria-label={`${effect.name} multiplier`}
                type="number"
                min="0"
                step="0.1"
                value={effect.scoreMultiplier}
                onChange={(e) =>
                  updateEffect(i, { scoreMultiplier: Number(e.target.value) })
                }
              />
              <input
                aria-label={`${effect.name} flat bonus`}
                type="number"
                value={effect.flatBonus}
                onChange={(e) =>
                  updateEffect(i, { flatBonus: Number(e.target.value) })
                }
              />
              <input
                aria-label={`${effect.name} timer milliseconds`}
                type="number"
                min="0"
                value={effect.timerOverrideMs ?? 0}
                onChange={(e) =>
                  updateEffect(i, {
                    timerOverrideMs: Number(e.target.value) || null,
                  })
                }
              />
              <label>
                <input
                  type="checkbox"
                  checked={effect.stealEnabled}
                  onChange={(e) =>
                    updateEffect(i, { stealEnabled: e.target.checked })
                  }
                />{" "}
                Steal
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={effect.active}
                  onChange={(e) =>
                    updateEffect(i, { active: e.target.checked })
                  }
                />{" "}
                Active
              </label>
              <input
                aria-label={`${effect.name} priority`}
                type="number"
                value={effect.displayPriority}
                onChange={(e) =>
                  updateEffect(i, { displayPriority: Number(e.target.value) })
                }
              />
              <input
                aria-label={`${effect.name} scope`}
                value={effect.appliesTo}
                onChange={(e) => updateEffect(i, { appliesTo: e.target.value })}
              />
              <input
                aria-label={`${effect.name} public description`}
                value={effect.publicDescription}
                onChange={(e) =>
                  updateEffect(i, { publicDescription: e.target.value })
                }
              />
              <input
                aria-label={`${effect.name} private instructions`}
                value={effect.privateInstructions}
                onChange={(e) =>
                  updateEffect(i, { privateInstructions: e.target.value })
                }
              />
            </div>
          ))}
          <button onClick={save}>Save D20 settings</button>
        </div>
      )}
      <details>
        <summary>Roll history ({state.d20History.length})</summary>
        <ol className="history">
          {state.d20History.map((r) => (
            <li key={r.id}>
              {new Date(r.rolledAt).toLocaleTimeString()} — {r.result} ·{" "}
              {r.mode.replace("_", " ")} · {r.effectName} · {r.status}
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
}
