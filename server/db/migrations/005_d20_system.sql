ALTER TABLE episodes ADD COLUMN active_d20_roll_id TEXT;
ALTER TABLE episodes ADD COLUMN d20_override_json TEXT;

ALTER TABLE episode_questions ADD COLUMN d20_roll_id TEXT;
ALTER TABLE episode_questions ADD COLUMN modifier_effect_key TEXT;
ALTER TABLE episode_questions ADD COLUMN base_xp INTEGER;
ALTER TABLE episode_questions ADD COLUMN effective_award_xp INTEGER;
ALTER TABLE episode_questions ADD COLUMN effective_deduction_xp INTEGER;
ALTER TABLE episode_questions ADD COLUMN timer_override_ms INTEGER;
ALTER TABLE episode_questions ADD COLUMN steal_enabled INTEGER NOT NULL DEFAULT 0 CHECK(steal_enabled IN (0,1));
ALTER TABLE episode_questions ADD COLUMN modifier_status TEXT;

CREATE TABLE d20_settings (
  id TEXT PRIMARY KEY CHECK(id='global'),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  mode TEXT NOT NULL DEFAULT 'question_selector' CHECK(mode IN ('question_selector','event_die','manual')),
  config_json TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE d20_effects (
  effect_key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  min_roll INTEGER NOT NULL CHECK(min_roll BETWEEN 1 AND 20),
  max_roll INTEGER NOT NULL CHECK(max_roll BETWEEN 1 AND 20),
  effect_type TEXT NOT NULL,
  score_multiplier REAL NOT NULL DEFAULT 1,
  flat_bonus INTEGER NOT NULL DEFAULT 0,
  timer_override_ms INTEGER,
  steal_enabled INTEGER NOT NULL DEFAULT 0 CHECK(steal_enabled IN (0,1)),
  applies_to TEXT NOT NULL DEFAULT 'correct_award',
  public_description TEXT NOT NULL DEFAULT '',
  private_instructions TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  display_priority INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE d20_rolls (
  id TEXT PRIMARY KEY,
  episode_id TEXT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  command_id TEXT NOT NULL UNIQUE,
  mode TEXT NOT NULL CHECK(mode IN ('question_selector','event_die')),
  result INTEGER NOT NULL CHECK(result BETWEEN 1 AND 20),
  effect_key TEXT,
  selected_question_id TEXT,
  category_name TEXT,
  question_value INTEGER,
  status TEXT NOT NULL CHECK(status IN ('requested','rolling','landed','acknowledged','applied','cancelled','undone')),
  config_revision INTEGER NOT NULL,
  config_snapshot_json TEXT NOT NULL,
  prior_state_json TEXT NOT NULL,
  effective_award_xp INTEGER,
  effective_deduction_xp INTEGER,
  timer_override_ms INTEGER,
  steal_enabled INTEGER NOT NULL DEFAULT 0,
  rerolls_roll_id TEXT,
  undone_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_d20_rolls_episode_created ON d20_rolls(episode_id,created_at);
