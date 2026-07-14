ALTER TABLE episodes ADD COLUMN public_display_mode TEXT NOT NULL DEFAULT 'standby'
  CHECK(public_display_mode IN ('standby','board','question','answer','scores','final'));
ALTER TABLE episodes ADD COLUMN active_question_id TEXT;
ALTER TABLE episodes ADD COLUMN answer_revealed INTEGER NOT NULL DEFAULT 0 CHECK(answer_revealed IN (0,1));
ALTER TABLE episodes ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE episodes ADD COLUMN timer_duration_ms INTEGER NOT NULL DEFAULT 30000;
ALTER TABLE episodes ADD COLUMN timer_remaining_ms INTEGER NOT NULL DEFAULT 30000;
ALTER TABLE episodes ADD COLUMN timer_status TEXT NOT NULL DEFAULT 'idle'
  CHECK(timer_status IN ('idle','running','paused','expired'));
ALTER TABLE episodes ADD COLUMN timer_resumed_at TEXT;
ALTER TABLE episodes ADD COLUMN timer_expired_at TEXT;

ALTER TABLE game_actions ADD COLUMN prior_state_json TEXT;
ALTER TABLE game_actions ADD COLUMN resulting_state_json TEXT;
ALTER TABLE game_actions ADD COLUMN undone_at TEXT;
ALTER TABLE game_actions ADD COLUMN compensating_action_id TEXT;
ALTER TABLE game_actions ADD COLUMN reverses_action_id TEXT;

CREATE TABLE live_commands (
  command_id TEXT PRIMARY KEY,
  episode_id TEXT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  command_type TEXT NOT NULL,
  resulting_revision INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_live_commands_episode ON live_commands(episode_id,created_at);
