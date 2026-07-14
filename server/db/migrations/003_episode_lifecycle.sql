PRAGMA foreign_keys = OFF;
ALTER TABLE episode_questions RENAME TO episode_questions_phase1;
ALTER TABLE episodes RENAME TO episodes_phase1;

CREATE TABLE episodes (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, seed TEXT NOT NULL,
  category_count INTEGER NOT NULL CHECK(category_count IN (4,5)),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','locked','in_progress','completed','archived')),
  options_json TEXT NOT NULL DEFAULT '{}', episode_number TEXT, scheduled_date TEXT,
  source_episode_id TEXT REFERENCES episodes(id), final_winner TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TEXT, completed_at TEXT, archived_at TEXT, usage_accounted_at TEXT
);
INSERT INTO episodes(id,title,seed,category_count,status,options_json,episode_number,scheduled_date,created_at,updated_at,completed_at)
SELECT id,title,seed,category_count,status,options_json,episode_number,scheduled_date,created_at,CASE WHEN updated_at='' THEN created_at ELSE updated_at END,completed_at FROM episodes_phase1;

CREATE TABLE episode_questions (
  episode_id TEXT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES questions(id), category_position INTEGER NOT NULL,
  difficulty INTEGER NOT NULL CHECK(difficulty BETWEEN 1 AND 5),
  state TEXT NOT NULL DEFAULT 'unopened' CHECK(state IN ('unopened','opened','completed','skipped')),
  opened_at TEXT, completed_at TEXT, outcome TEXT,
  awarded_participant_id TEXT, awarded_points INTEGER NOT NULL DEFAULT 0, notes TEXT,
  PRIMARY KEY(episode_id,question_id), UNIQUE(episode_id,category_position,difficulty)
);
INSERT INTO episode_questions(episode_id,question_id,category_position,difficulty,state)
SELECT episode_id,question_id,category_position,difficulty,CASE WHEN completed=1 THEN 'completed' ELSE 'unopened' END FROM episode_questions_phase1;

CREATE TABLE episode_participants (
  id TEXT PRIMARY KEY, episode_id TEXT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL, color TEXT, score INTEGER NOT NULL DEFAULT 0,
  placement INTEGER, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(episode_id,display_name)
);
CREATE INDEX idx_participants_episode ON episode_participants(episode_id);

CREATE TABLE game_actions (
  id TEXT PRIMARY KEY, episode_id TEXT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  question_id TEXT, participant_id TEXT, point_delta INTEGER NOT NULL DEFAULT 0,
  reason TEXT, metadata_json TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX idx_actions_episode_created ON game_actions(episode_id,created_at);

DROP TABLE episode_questions_phase1;
DROP TABLE episodes_phase1;
PRAGMA foreign_keys = ON;
