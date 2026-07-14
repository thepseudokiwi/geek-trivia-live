import crypto from "node:crypto";
import type {
  D20Effect,
  D20Settings,
  LiveCommand,
  PrivateD20State,
  PublicD20State,
} from "../shared/types.js";
import { db } from "./db/database.js";
import { LifecycleError } from "./episodesRepository.js";
export type RandomInt = (maxExclusive: number) => number;
const secureRandom: RandomInt = (max) =>
  process.env.NODE_ENV === "test" && process.env.D20_TEST_RESULT
    ? (Number(process.env.D20_TEST_RESULT) - 1) % max
    : crypto.randomInt(max);
export function selectEligible<T>(pool: T[], randomInt: RandomInt): T {
  if (!pool.length)
    throw new LifecycleError(
      "NO_ELIGIBLE_QUESTIONS",
      "No eligible board questions remain.",
    );
  return pool[randomInt(pool.length)];
}
const defaultEffects: D20Effect[] = [
  {
    key: "critical_failure",
    name: "Critical Failure",
    minRoll: 1,
    maxRoll: 1,
    effectType: "critical_failure",
    scoreMultiplier: 1,
    flatBonus: 0,
    timerOverrideMs: null,
    stealEnabled: false,
    appliesTo: "wrong_answer_consequence",
    publicDescription:
      "Natural 1 — the question remains playable, but danger awaits.",
    privateInstructions:
      "A wrong answer may deduct base XP. Confirm any deduction explicitly.",
    active: true,
    displayPriority: 1,
  },
  {
    key: "normal",
    name: "Normal Question",
    minRoll: 2,
    maxRoll: 9,
    effectType: "normal",
    scoreMultiplier: 1,
    flatBonus: 0,
    timerOverrideMs: null,
    stealEnabled: false,
    appliesTo: "correct_award",
    publicDescription: "No modifier. Play for the base value.",
    privateInstructions: "Run the question normally.",
    active: true,
    displayPriority: 2,
  },
  {
    key: "speed",
    name: "Speed Challenge",
    minRoll: 10,
    maxRoll: 13,
    effectType: "speed",
    scoreMultiplier: 1,
    flatBonus: 0,
    timerOverrideMs: 10000,
    stealEnabled: false,
    appliesTo: "timer",
    publicDescription: "Only 10 seconds on the clock!",
    privateInstructions:
      "Use the 10-second timer override. The timer does not start automatically.",
    active: true,
    displayPriority: 3,
  },
  {
    key: "bonus_100",
    name: "Bonus 100 XP",
    minRoll: 14,
    maxRoll: 16,
    effectType: "flat_bonus",
    scoreMultiplier: 1,
    flatBonus: 100,
    timerOverrideMs: null,
    stealEnabled: false,
    appliesTo: "correct_award",
    publicDescription: "A correct answer earns 100 bonus XP.",
    privateInstructions: "Award base XP plus 100 for a correct answer.",
    active: true,
    displayPriority: 4,
  },
  {
    key: "steal",
    name: "Steal Enabled",
    minRoll: 17,
    maxRoll: 18,
    effectType: "steal",
    scoreMultiplier: 1,
    flatBonus: 0,
    timerOverrideMs: null,
    stealEnabled: true,
    appliesTo: "question",
    publicDescription: "Another team may steal after an incorrect response.",
    privateInstructions:
      "Record the initial miss, then choose one stealing participant for the final award.",
    active: true,
    displayPriority: 5,
  },
  {
    key: "double",
    name: "Double XP",
    minRoll: 19,
    maxRoll: 19,
    effectType: "multiplier",
    scoreMultiplier: 2,
    flatBonus: 0,
    timerOverrideMs: null,
    stealEnabled: false,
    appliesTo: "correct_award",
    publicDescription: "A correct answer is worth double XP!",
    privateInstructions:
      "Correct award is base XP × 2. Deduction remains base XP by default.",
    active: true,
    displayPriority: 6,
  },
  {
    key: "critical_hit",
    name: "Critical Hit: Triple XP",
    minRoll: 20,
    maxRoll: 20,
    effectType: "multiplier",
    scoreMultiplier: 3,
    flatBonus: 0,
    timerOverrideMs: null,
    stealEnabled: false,
    appliesTo: "correct_award",
    publicDescription: "Natural 20 — a correct answer is worth triple XP!",
    privateInstructions: "Confirm the participant before awarding base XP × 3.",
    active: true,
    displayPriority: 7,
  },
];
const defaultConfig = {
  enabled: true,
  mode: "question_selector" as const,
  animationDurationMs: 2200,
  reducedMotionDurationMs: 250,
  autoShowPublic: true,
  autoReturn: false,
  autoSelectQuestion: true,
  requireConfirmation: true,
  modifiersAffectDeductions: false,
  skippedEligible: false,
  speedDurationMs: 10000,
  criticalFailureConsequence: "wrong_answer_may_deduct_base_xp",
  resultDisplayDurationMs: 5000,
  soundEnabled: false,
  volume: 0.5,
  theme: "neon_arcane" as const,
};
const now = () => new Date().toISOString();
const requireEpisode = (id: string): any => {
  const e = db.prepare("SELECT * FROM episodes WHERE id=?").get(id);
  if (!e) throw new LifecycleError("EPISODE_NOT_FOUND", "Episode not found.");
  return e;
};
export function validateEffectTable(effects: D20Effect[]) {
  if (!Array.isArray(effects) || !effects.length)
    throw new LifecycleError(
      "INVALID_RULE_TABLE",
      "At least one active D20 effect is required.",
    );
  const coverage = Array(21).fill(0);
  for (const e of effects) {
    if (
      !e.key ||
      !e.name ||
      !Number.isInteger(e.minRoll) ||
      !Number.isInteger(e.maxRoll) ||
      e.minRoll < 1 ||
      e.maxRoll > 20 ||
      e.minRoll > e.maxRoll ||
      e.scoreMultiplier < 0 ||
      !Number.isInteger(e.flatBonus)
    )
      throw new LifecycleError(
        "INVALID_EFFECT",
        "Every effect requires a valid key, name, range, multiplier, and flat bonus.",
      );
    if (e.active) for (let n = e.minRoll; n <= e.maxRoll; n++) coverage[n]++;
  }
  const gaps: number[] = [],
    overlaps: number[] = [];
  for (let n = 1; n <= 20; n++) {
    if (coverage[n] === 0) gaps.push(n);
    if (coverage[n] > 1) overlaps.push(n);
  }
  if (gaps.length || overlaps.length)
    throw new LifecycleError(
      "INVALID_RULE_TABLE",
      "Active effects must cover rolls 1–20 exactly once.",
      { gaps, overlaps },
    );
  return true;
}
function ensureDefaults() {
  if (!db.prepare("SELECT 1 FROM d20_settings WHERE id='global'").get()) {
    db.exec("BEGIN");
    try {
      db.prepare(
        "INSERT INTO d20_settings(id,enabled,mode,config_json) VALUES('global',1,'question_selector',?)",
      ).run(JSON.stringify(defaultConfig));
      const add = db.prepare(
        `INSERT INTO d20_effects(effect_key,name,min_roll,max_roll,effect_type,score_multiplier,flat_bonus,timer_override_ms,steal_enabled,applies_to,public_description,private_instructions,active,display_priority) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      );
      for (const e of defaultEffects)
        add.run(
          e.key,
          e.name,
          e.minRoll,
          e.maxRoll,
          e.effectType,
          e.scoreMultiplier,
          e.flatBonus,
          e.timerOverrideMs,
          e.stealEnabled ? 1 : 0,
          e.appliesTo,
          e.publicDescription,
          e.privateInstructions,
          e.active ? 1 : 0,
          e.displayPriority,
        );
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
}
const effectRow = (r: any): D20Effect => ({
  key: r.effect_key,
  name: r.name,
  minRoll: r.min_roll,
  maxRoll: r.max_roll,
  effectType: r.effect_type,
  scoreMultiplier: r.score_multiplier,
  flatBonus: r.flat_bonus,
  timerOverrideMs: r.timer_override_ms,
  stealEnabled: Boolean(r.steal_enabled),
  appliesTo: r.applies_to,
  publicDescription: r.public_description,
  privateInstructions: r.private_instructions,
  active: Boolean(r.active),
  displayPriority: r.display_priority,
});
export function getD20Settings(episodeId?: string): D20Settings {
  ensureDefaults();
  const r: any = db
      .prepare("SELECT * FROM d20_settings WHERE id='global'")
      .get(),
    effects = (
      db
        .prepare("SELECT * FROM d20_effects ORDER BY display_priority,min_roll")
        .all() as any[]
    ).map(effectRow),
    base = {
      ...JSON.parse(r.config_json),
      enabled: Boolean(r.enabled),
      mode: r.mode,
      revision: r.revision,
      effects,
    };
  if (episodeId) {
    const e: any = requireEpisode(episodeId);
    return e.d20_override_json
      ? { ...base, ...JSON.parse(e.d20_override_json), effects }
      : base;
  }
  return base;
}
export function saveD20Settings(input: Partial<D20Settings>) {
  const current = getD20Settings(),
    effects = input.effects ?? current.effects;
  validateEffectTable(effects);
  const next = {
    ...current,
    ...input,
    effects,
    revision: current.revision + 1,
  };
  if (
    !["question_selector", "event_die", "manual"].includes(next.mode) ||
    next.animationDurationMs < 0 ||
    next.reducedMotionDurationMs < 0 ||
    next.volume < 0 ||
    next.volume > 1
  )
    throw new LifecycleError("INVALID_D20_SETTINGS", "Invalid D20 settings.");
  db.exec("BEGIN");
  try {
    const {
      effects: _effects,
      revision: _revision,
      enabled,
      mode,
      ...config
    } = next;
    db.prepare(
      "UPDATE d20_settings SET enabled=?,mode=?,config_json=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id='global'",
    ).run(enabled ? 1 : 0, mode, JSON.stringify(config));
    db.prepare("DELETE FROM d20_effects").run();
    const add = db.prepare(
      `INSERT INTO d20_effects(effect_key,name,min_roll,max_roll,effect_type,score_multiplier,flat_bonus,timer_override_ms,steal_enabled,applies_to,public_description,private_instructions,active,display_priority) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    );
    for (const e of effects)
      add.run(
        e.key,
        e.name,
        e.minRoll,
        e.maxRoll,
        e.effectType,
        e.scoreMultiplier,
        e.flatBonus,
        e.timerOverrideMs,
        e.stealEnabled ? 1 : 0,
        e.appliesTo,
        e.publicDescription,
        e.privateInstructions,
        e.active ? 1 : 0,
        e.displayPriority,
      );
    db.exec("COMMIT");
    return getD20Settings();
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
export function saveEpisodeD20Settings(
  id: string,
  input: Partial<D20Settings>,
) {
  const e = requireEpisode(id);
  if (!["draft", "locked", "in_progress"].includes(e.status))
    throw new LifecycleError(
      "INVALID_TRANSITION",
      "Completed episodes cannot change D20 settings.",
    );
  const allowed = [
    "enabled",
    "mode",
    "animationDurationMs",
    "reducedMotionDurationMs",
    "autoShowPublic",
    "autoReturn",
    "autoSelectQuestion",
    "requireConfirmation",
    "modifiersAffectDeductions",
    "skippedEligible",
    "speedDurationMs",
    "criticalFailureConsequence",
    "resultDisplayDurationMs",
    "soundEnabled",
    "volume",
    "theme",
  ];
  const override = Object.fromEntries(
    Object.entries(input).filter(([k]) => allowed.includes(k)),
  );
  db.prepare(
    "UPDATE episodes SET d20_override_json=?,revision=revision+1 WHERE id=?",
  ).run(JSON.stringify(override), id);
  return getD20Settings(id);
}
function resolvedEffect(settings: D20Settings, result: number) {
  return settings.effects.find(
    (e) => e.active && result >= e.minRoll && result <= e.maxRoll,
  )!;
}
function calc(
  base: number,
  effect: D20Effect | undefined,
  settings: D20Settings,
) {
  const award = Math.round(
    base * (effect?.scoreMultiplier ?? 1) + (effect?.flatBonus ?? 0),
  );
  const deduction = settings.modifiersAffectDeductions ? award : base;
  return {
    award,
    deduction,
    timer: effect?.timerOverrideMs ?? null,
    steal: Boolean(effect?.stealEnabled),
  };
}
function rollRow(id: string): any {
  return db.prepare("SELECT * FROM d20_rolls WHERE id=?").get(id);
}
function project(
  row: any,
  settings: D20Settings,
  privateView = false,
): PublicD20State | PrivateD20State {
  const effect = row.effect_key
    ? settings.effects.find((e) => e.key === row.effect_key)
    : undefined;
  const base = {
    result: row.result,
    mode: row.mode,
    status: row.status,
    effectName: effect?.name ?? "Question Selected",
    publicDescription:
      effect?.publicDescription ?? "The die has chosen the next square.",
    selectedSquare: row.category_name
      ? { category: row.category_name, value: row.question_value }
      : null,
    effectiveAwardXp: row.effective_award_xp,
    timerOverrideMs: row.timer_override_ms,
    stealEnabled: Boolean(row.steal_enabled),
    rolledAt: row.created_at,
    animationDurationMs: settings.animationDurationMs,
    resultDisplayDurationMs: settings.resultDisplayDurationMs,
    autoReturn: settings.autoReturn,
    theme: settings.theme,
    soundEnabled: settings.soundEnabled,
    volume: settings.volume,
  };
  return privateView
    ? {
        ...base,
        id: row.id,
        effectKey: row.effect_key,
        privateInstructions:
          effect?.privateInstructions ??
          "The selected square remains private until you show the question.",
        selectedQuestionId: row.selected_question_id,
        effectiveDeductionXp: row.effective_deduction_xp,
        configRevision: row.config_revision,
        canApply: ["rolling", "landed", "acknowledged"].includes(row.status),
        canCancel: ["rolling", "landed", "acknowledged"].includes(row.status),
        canUndo: !["undone", "cancelled"].includes(row.status),
      }
    : base;
}
export function getPublicD20(id: string) {
  const e = requireEpisode(id);
  if (!e.active_d20_roll_id) return null;
  const settings = getD20Settings(id);
  if (!settings.autoShowPublic) return null;
  return project(
    rollRow(e.active_d20_roll_id),
    settings,
    false,
  ) as PublicD20State;
}
export function getPrivateD20(id: string) {
  const e = requireEpisode(id);
  if (!e.active_d20_roll_id) return null;
  return project(
    rollRow(e.active_d20_roll_id),
    getD20Settings(id),
    true,
  ) as PrivateD20State;
}
export function getD20History(id: string) {
  const settings = getD20Settings(id);
  return (
    db
      .prepare(
        "SELECT * FROM d20_rolls WHERE episode_id=? ORDER BY rowid DESC LIMIT 30",
      )
      .all(id) as any[]
  ).map((r) => project(r, settings, true) as PrivateD20State);
}
function priorState(id: string, qid: string | null) {
  const e: any = requireEpisode(id),
    q = qid
      ? db
          .prepare(
            "SELECT * FROM episode_questions WHERE episode_id=? AND question_id=?",
          )
          .get(id, qid)
      : null;
  return {
    activeQuestionId: e.active_question_id,
    answerRevealed: e.answer_revealed,
    publicMode: e.public_display_mode,
    question: q
      ? { id: qid, state: (q as any).state, openedAt: (q as any).opened_at }
      : null,
  };
}
function restorePrior(id: string, p: any) {
  db.prepare(
    "UPDATE episodes SET active_question_id=?,answer_revealed=?,public_display_mode=?,active_d20_roll_id=NULL WHERE id=?",
  ).run(p.activeQuestionId, p.answerRevealed, p.publicMode, id);
  if (p.question)
    db.prepare(
      "UPDATE episode_questions SET state=?,opened_at=? WHERE episode_id=? AND question_id=?",
    ).run(p.question.state, p.question.openedAt, id, p.question.id);
}
const action = (
  id: string,
  type: string,
  qid: string | null,
  metadata: unknown,
) =>
  db
    .prepare(
      "INSERT INTO game_actions(id,episode_id,action_type,question_id,metadata_json) VALUES(?,?,?,?,?)",
    )
    .run(crypto.randomUUID(), id, type, qid, JSON.stringify(metadata));
export function executeD20Command(
  input: LiveCommand,
  randomInt: RandomInt = secureRandom,
): { duplicate: boolean; revision: number; rollId?: string; result?: number } {
  const existing: any = db
    .prepare("SELECT resulting_revision FROM live_commands WHERE command_id=?")
    .get(input.commandId);
  if (existing) {
    const r: any = db
      .prepare("SELECT id,result FROM d20_rolls WHERE command_id=?")
      .get(input.commandId);
    return {
      duplicate: true,
      revision: existing.resulting_revision,
      rollId: r?.id,
      result: r?.result,
    };
  }
  const e: any = requireEpisode(input.episodeId);
  if (e.status !== "in_progress")
    throw new LifecycleError(
      "INVALID_TRANSITION",
      "D20 commands require an in-progress episode.",
    );
  if (e.revision !== input.expectedRevision)
    throw new LifecycleError(
      "STALE_REVISION",
      "The episode changed. Refresh and try again.",
      { expected: input.expectedRevision, actual: e.revision },
    );
  const settings = getD20Settings(input.episodeId);
  if (!settings.enabled)
    throw new LifecycleError("D20_DISABLED", "The D20 is disabled.");
  const p = input.payload as any;
  let rollId: string | undefined, result: number | undefined;
  db.exec("BEGIN");
  try {
    const applyRoll = (row: any) => {
      db.prepare(
        `UPDATE episode_questions SET d20_roll_id=?,modifier_effect_key=?,base_xp=?,effective_award_xp=?,effective_deduction_xp=?,timer_override_ms=?,steal_enabled=?,modifier_status='active' WHERE episode_id=? AND question_id=?`,
      ).run(
        row.id, row.effect_key, row.question_value, row.effective_award_xp,
        row.effective_deduction_xp, row.timer_override_ms, row.steal_enabled,
        input.episodeId, row.selected_question_id,
      );
      if (row.timer_override_ms)
        db.prepare(
          "UPDATE episodes SET timer_duration_ms=?,timer_remaining_ms=?,timer_status='idle',timer_resumed_at=NULL,timer_expired_at=NULL WHERE id=?",
        ).run(row.timer_override_ms, row.timer_override_ms, input.episodeId);
      db.prepare("UPDATE d20_rolls SET status='applied',updated_at=CURRENT_TIMESTAMP WHERE id=?").run(row.id);
      db.prepare("UPDATE episodes SET active_d20_roll_id=NULL WHERE id=?").run(input.episodeId);
      action(input.episodeId, "d20_applied", row.selected_question_id, {
        rollId: row.id,
        effectiveAwardXp: row.effective_award_xp,
      });
    };
    if (input.type === "d20.roll" || input.type === "d20.reroll") {
      if (e.active_d20_roll_id)
        throw new LifecycleError(
          "ROLL_ALREADY_ACTIVE",
          "A D20 result is already active. Acknowledge, apply, cancel, or undo it first.",
        );
      const mode = p.mode ?? settings.mode;
      if (
        !["question_selector", "event_die"].includes(mode) ||
        mode !== settings.mode
      )
        throw new LifecycleError(
          "INVALID_D20_MODE",
          "The requested D20 mode is not active.",
        );
      let q: any;
      if (mode === "question_selector") {
        if (e.active_question_id)
          throw new LifecycleError(
            "QUESTION_ALREADY_ACTIVE",
            "Close the current question before selector mode rolls.",
          );
        const allowed = settings.skippedEligible
          ? "('unopened','skipped')"
          : "('unopened')";
        const pool = db
          .prepare(
            `SELECT eq.*,q.category FROM episode_questions eq JOIN questions q ON q.id=eq.question_id WHERE eq.episode_id=? AND eq.state IN ${allowed} ORDER BY eq.category_position,eq.difficulty`,
          )
          .all(input.episodeId) as any[];
        if (!pool.length)
          throw new LifecycleError(
            "NO_ELIGIBLE_QUESTIONS",
            "No eligible board questions remain.",
          );
        q = pool[randomInt(pool.length)];
      } else {
        if (!e.active_question_id)
          throw new LifecycleError(
            "EVENT_QUESTION_REQUIRED",
            "Select a question before rolling the Event Die.",
          );
        q = db
          .prepare(
            "SELECT eq.*,q.category FROM episode_questions eq JOIN questions q ON q.id=eq.question_id WHERE eq.episode_id=? AND eq.question_id=?",
          )
          .get(input.episodeId, e.active_question_id);
        if (!q || !["unopened", "opened"].includes(q.state))
          throw new LifecycleError(
            "SELECTED_QUESTION_INELIGIBLE",
            "The active question is not eligible.",
          );
      }
      result = randomInt(20) + 1;
      const effect =
          mode === "event_die" ? resolvedEffect(settings, result) : undefined,
        values = calc(q.difficulty * 100, effect, settings),
        prior = priorState(input.episodeId, q.question_id);
      rollId = crypto.randomUUID();
      db.prepare(
        `INSERT INTO d20_rolls(id,episode_id,command_id,mode,result,effect_key,selected_question_id,category_name,question_value,status,config_revision,config_snapshot_json,prior_state_json,effective_award_xp,effective_deduction_xp,timer_override_ms,steal_enabled,rerolls_roll_id) VALUES(?,?,?,?,?,?,?,?,?,'rolling',?,?,?,?,?,?,?,?)`,
      ).run(
        rollId,
        input.episodeId,
        input.commandId,
        mode,
        result,
        effect?.key ?? null,
        q.question_id,
        q.category,
        q.difficulty * 100,
        settings.revision,
        JSON.stringify(settings),
        JSON.stringify(prior),
        values.award,
        values.deduction,
        values.timer,
        values.steal ? 1 : 0,
        p.rerollsRollId ?? null,
      );
      db.prepare("UPDATE episodes SET active_d20_roll_id=? WHERE id=?").run(
        rollId,
        input.episodeId,
      );
      if (mode === "question_selector" && settings.autoSelectQuestion) {
        db.prepare(
          "UPDATE episode_questions SET state='opened',opened_at=COALESCE(opened_at,?) WHERE episode_id=? AND question_id=?",
        ).run(now(), input.episodeId, q.question_id);
        db.prepare(
          "UPDATE episodes SET active_question_id=?,answer_revealed=0 WHERE id=?",
        ).run(q.question_id, input.episodeId);
      }
      action(
        input.episodeId,
        input.type === "d20.reroll" ? "d20_rerolled" : "d20_rolled",
        q.question_id,
        { rollId, result, mode },
      );
      if (mode === "event_die" && !settings.requireConfirmation)
        applyRoll(rollRow(rollId));
    } else {
      const row: any = e.active_d20_roll_id
        ? rollRow(e.active_d20_roll_id)
        : input.type === "d20.undo"
          ? db
              .prepare(
                "SELECT * FROM d20_rolls WHERE episode_id=? AND status IN ('applied','acknowledged') AND undone_at IS NULL ORDER BY rowid DESC LIMIT 1",
              )
              .get(input.episodeId)
          : null;
      if (!row)
        throw new LifecycleError(
          "NO_ACTIVE_ROLL",
          "There is no active D20 roll.",
        );
      if (input.type === "d20.acknowledge") {
        if (row.mode === "question_selector" && !e.active_question_id) {
          db.prepare(
            "UPDATE episode_questions SET state='opened',opened_at=COALESCE(opened_at,?) WHERE episode_id=? AND question_id=?",
          ).run(now(), input.episodeId, row.selected_question_id);
          db.prepare(
            "UPDATE episodes SET active_question_id=?,answer_revealed=0 WHERE id=?",
          ).run(row.selected_question_id, input.episodeId);
        }
        db.prepare(
          "UPDATE d20_rolls SET status='acknowledged',updated_at=CURRENT_TIMESTAMP WHERE id=?",
        ).run(row.id);
        if (row.mode === "question_selector" || row.mode === "event_die")
          db.prepare(
            "UPDATE episodes SET active_d20_roll_id=NULL,public_display_mode='board' WHERE id=?",
          ).run(input.episodeId);
        action(input.episodeId, "d20_acknowledged", row.selected_question_id, {
          rollId: row.id,
        });
      } else if (input.type === "d20.apply") {
        if (row.status === "applied")
          throw new LifecycleError(
            "ROLL_ALREADY_APPLIED",
            "This roll is already applied.",
          );
        applyRoll(row);
      } else if (input.type === "d20.cancel") {
        restorePrior(input.episodeId, JSON.parse(row.prior_state_json));
        db.prepare(
          "UPDATE d20_rolls SET status='cancelled',updated_at=CURRENT_TIMESTAMP WHERE id=?",
        ).run(row.id);
        action(input.episodeId, "d20_cancelled", row.selected_question_id, {
          rollId: row.id,
          reason: p.reason ?? null,
        });
      } else if (input.type === "d20.undo") {
        const scored: any = db
          .prepare(
            "SELECT 1 FROM game_actions WHERE episode_id=? AND question_id=? AND action_type='question_scored' AND undone_at IS NULL LIMIT 1",
          )
          .get(input.episodeId, row.selected_question_id);
        if (scored)
          throw new LifecycleError(
            "D20_UNDO_UNSAFE",
            "Undo the dependent score action before undoing this roll.",
          );
        restorePrior(input.episodeId, JSON.parse(row.prior_state_json));
        db.prepare(
          "UPDATE episode_questions SET d20_roll_id=NULL,modifier_effect_key=NULL,base_xp=NULL,effective_award_xp=NULL,effective_deduction_xp=NULL,timer_override_ms=NULL,steal_enabled=0,modifier_status=NULL WHERE episode_id=? AND question_id=?",
        ).run(input.episodeId, row.selected_question_id);
        db.prepare(
          "UPDATE d20_rolls SET status='undone',undone_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND undone_at IS NULL",
        ).run(now(), row.id);
        action(input.episodeId, "d20_undone", row.selected_question_id, {
          rollId: row.id,
          warning: "Viewers may already have seen this result.",
        });
      } else
        throw new LifecycleError("INVALID_D20_COMMAND", "Unknown D20 command.");
    }
    db.prepare(
      "UPDATE episodes SET revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=?",
    ).run(input.episodeId);
    const revision = (
      db
        .prepare("SELECT revision FROM episodes WHERE id=?")
        .get(input.episodeId) as any
    ).revision;
    db.prepare(
      "INSERT INTO live_commands(command_id,episode_id,command_type,resulting_revision) VALUES(?,?,?,?)",
    ).run(input.commandId, input.episodeId, input.type, revision);
    db.exec("COMMIT");
    return { duplicate: false, revision, rollId, result };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
export function scoreActiveQuestion(
  id: string,
  participantId: string,
  direction: "award" | "deduct",
) {
  const e: any = requireEpisode(id);
  if (!e.active_question_id)
    throw new LifecycleError("NO_ACTIVE_QUESTION", "Select a question first.");
  const q: any = db
    .prepare(
      "SELECT eq.*,q.difficulty FROM episode_questions eq JOIN questions q ON q.id=eq.question_id WHERE eq.episode_id=? AND eq.question_id=?",
    )
    .get(id, e.active_question_id);
  if (
    direction === "award" &&
    db
      .prepare(
        "SELECT 1 FROM game_actions WHERE episode_id=? AND question_id=? AND action_type='question_scored' AND point_delta>0 AND undone_at IS NULL",
      )
      .get(id, q.question_id)
  )
    throw new LifecycleError(
      "QUESTION_ALREADY_AWARDED",
      "This question already has a correct award.",
    );
  const base = q.difficulty * 100,
    delta =
      direction === "award"
        ? (q.effective_award_xp ?? base)
        : -(q.effective_deduction_xp ?? base);
  const r = db
    .prepare(
      "UPDATE episode_participants SET score=score+? WHERE episode_id=? AND id=?",
    )
    .run(delta, id, participantId);
  if (!r.changes)
    throw new LifecycleError("PARTICIPANT_NOT_FOUND", "Participant not found.");
  return {
    questionId: q.question_id,
    delta,
    base,
    effectKey: q.modifier_effect_key,
  };
}
export function exportD20Backup() {
  ensureDefaults();
  return {
    settings: db.prepare("SELECT * FROM d20_settings").all(),
    effects: db.prepare("SELECT * FROM d20_effects").all(),
    rolls: db.prepare("SELECT * FROM d20_rolls").all(),
  };
}
export function restoreD20Backup(data: any) {
  if (!data) return;
  const effects = (data.effects ?? []).map(effectRow);
  validateEffectTable(effects);
  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM d20_rolls").run();
    db.prepare("DELETE FROM d20_effects").run();
    db.prepare("DELETE FROM d20_settings").run();
    for (const [table, rows] of [
      ["d20_settings", data.settings ?? []],
      ["d20_effects", data.effects ?? []],
      ["d20_rolls", data.rolls ?? []],
    ] as any)
      for (const row of rows) {
        const keys = Object.keys(row);
        db.prepare(
          `INSERT INTO ${table}(${keys.join(",")}) VALUES(${keys.map(() => "?").join(",")})`,
        ).run(...keys.map((k) => row[k]));
      }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
