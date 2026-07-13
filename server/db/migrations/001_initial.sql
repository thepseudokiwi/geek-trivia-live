PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY, category TEXT NOT NULL, subcategory TEXT NOT NULL,
  difficulty INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
  point_value INTEGER NOT NULL CHECK (point_value > 0), question_text TEXT NOT NULL,
  correct_answer TEXT NOT NULL, alternate_answers TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(alternate_answers)),
  question_type TEXT NOT NULL DEFAULT 'text' CHECK (question_type IN ('text','image','audio','video','multiple-choice')),
  media_path TEXT, host_notes TEXT NOT NULL DEFAULT '', source TEXT NOT NULL DEFAULT '',
  used INTEGER NOT NULL DEFAULT 0 CHECK (used IN (0,1)), date_last_used TEXT, episode_last_used TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_questions_category_difficulty ON questions(category, difficulty);
CREATE INDEX IF NOT EXISTS idx_questions_used ON questions(used, date_last_used);

CREATE TABLE IF NOT EXISTS episodes (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, seed TEXT NOT NULL, category_count INTEGER NOT NULL CHECK(category_count IN (4,5)),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','locked','in_progress','completed')),
  options_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, completed_at TEXT
);
CREATE TABLE IF NOT EXISTS episode_questions (
  episode_id TEXT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES questions(id), category_position INTEGER NOT NULL, difficulty INTEGER NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(episode_id, question_id), UNIQUE(episode_id, category_position, difficulty)
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value_json TEXT NOT NULL);
INSERT OR IGNORE INTO settings(key, value_json) VALUES ('event_die_modifiers', '["Double XP","Half XP","Steal opportunity","Team challenge","Lose 100 XP","No modifier"]');
