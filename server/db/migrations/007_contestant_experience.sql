CREATE TABLE join_sessions (
 id TEXT PRIMARY KEY, episode_id TEXT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
 join_code TEXT NOT NULL UNIQUE, status TEXT NOT NULL CHECK(status IN('closed','open','locked','in-progress','expired','revoked')),
 pin_hash TEXT, expires_at TEXT NOT NULL, max_participants INTEGER NOT NULL DEFAULT 8,
 local_only INTEGER NOT NULL DEFAULT 1, late_join_policy TEXT NOT NULL DEFAULT 'allow',
 team_mode TEXT NOT NULL DEFAULT 'individual' CHECK(team_mode IN('individual','team')),
 multiple_team_devices INTEGER NOT NULL DEFAULT 0, minimum_ready INTEGER NOT NULL DEFAULT 1,
 require_ready INTEGER NOT NULL DEFAULT 0, ready_check_open INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, revoked_at TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX idx_join_sessions_episode_active ON join_sessions(episode_id) WHERE status NOT IN('expired','revoked');

CREATE TABLE contestant_teams (
 id TEXT PRIMARY KEY, episode_id TEXT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
 participant_id TEXT NOT NULL REFERENCES episode_participants(id) ON DELETE CASCADE,
 name TEXT NOT NULL, captain_session_id TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(episode_id,name), UNIQUE(episode_id,participant_id)
);

CREATE TABLE contestant_sessions (
 id TEXT PRIMARY KEY, join_session_id TEXT NOT NULL REFERENCES join_sessions(id) ON DELETE CASCADE,
 episode_id TEXT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
 participant_id TEXT NOT NULL REFERENCES episode_participants(id) ON DELETE CASCADE,
 team_id TEXT REFERENCES contestant_teams(id) ON DELETE SET NULL,
 token_hash TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL, avatar TEXT NOT NULL DEFAULT 'rocket',
 color TEXT NOT NULL DEFAULT '#7c3aed', status TEXT NOT NULL DEFAULT 'connected',
 ready INTEGER NOT NULL DEFAULT 0, device_role TEXT NOT NULL DEFAULT 'controller' CHECK(device_role IN('controller','observer','captain')),
 token_expires_at TEXT NOT NULL, connected_at TEXT, disconnected_at TEXT, last_heartbeat_at TEXT,
 approximate_rtt_ms INTEGER, reconnect_count INTEGER NOT NULL DEFAULT 0, duplicate_command_count INTEGER NOT NULL DEFAULT 0,
 last_buzz_rejection TEXT, user_agent_summary TEXT, revoked_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_contestant_sessions_episode ON contestant_sessions(episode_id,status);

CREATE TABLE buzzer_sessions (
 id TEXT PRIMARY KEY, episode_id TEXT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
 question_id TEXT REFERENCES questions(id), state TEXT NOT NULL CHECK(state IN('disabled','armed','open','locked','answering','steal-open','resolved','cancelled')),
 revision INTEGER NOT NULL DEFAULT 1, winner_session_id TEXT REFERENCES contestant_sessions(id), winner_participant_id TEXT REFERENCES episode_participants(id),
 opened_at TEXT, locked_at TEXT, resolved_at TEXT, incorrect_participants_json TEXT NOT NULL DEFAULT '[]',
 rules_json TEXT NOT NULL DEFAULT '{}', response_duration_ms INTEGER NOT NULL DEFAULT 15000,
 response_remaining_ms INTEGER NOT NULL DEFAULT 15000, response_status TEXT NOT NULL DEFAULT 'idle',
 response_resumed_at TEXT, response_expired_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_buzzer_sessions_episode ON buzzer_sessions(episode_id,created_at);

CREATE TABLE buzz_attempts (
 id TEXT PRIMARY KEY, buzzer_session_id TEXT NOT NULL REFERENCES buzzer_sessions(id) ON DELETE CASCADE,
 episode_id TEXT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE, contestant_session_id TEXT NOT NULL REFERENCES contestant_sessions(id),
 participant_id TEXT NOT NULL REFERENCES episode_participants(id), command_id TEXT NOT NULL UNIQUE, client_sequence INTEGER NOT NULL,
 client_timestamp TEXT, server_received_at TEXT NOT NULL, monotonic_ns TEXT NOT NULL, episode_revision INTEGER NOT NULL,
 buzzer_revision INTEGER NOT NULL, accepted INTEGER NOT NULL, rejection_reason TEXT, final_position INTEGER,
 approximate_latency_ms INTEGER, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(buzzer_session_id,contestant_session_id,client_sequence)
);
CREATE INDEX idx_buzz_attempts_queue ON buzz_attempts(buzzer_session_id,server_received_at,id);

CREATE TABLE contestant_connection_events (
 id TEXT PRIMARY KEY, contestant_session_id TEXT NOT NULL REFERENCES contestant_sessions(id) ON DELETE CASCADE,
 event_type TEXT NOT NULL, metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE contestant_statistics (
 episode_id TEXT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE, participant_id TEXT NOT NULL REFERENCES episode_participants(id) ON DELETE CASCADE,
 buzz_attempts INTEGER NOT NULL DEFAULT 0, accepted_buzzes INTEGER NOT NULL DEFAULT 0, first_buzzes INTEGER NOT NULL DEFAULT 0,
 lockouts INTEGER NOT NULL DEFAULT 0, correct_answers INTEGER NOT NULL DEFAULT 0, incorrect_answers INTEGER NOT NULL DEFAULT 0,
 steal_attempts INTEGER NOT NULL DEFAULT 0, successful_steals INTEGER NOT NULL DEFAULT 0,
 points_earned INTEGER NOT NULL DEFAULT 0, points_lost INTEGER NOT NULL DEFAULT 0,
 total_arrival_ms INTEGER NOT NULL DEFAULT 0, fastest_arrival_ms INTEGER, disconnect_count INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(episode_id,participant_id)
);

CREATE TABLE contestant_rate_limits (
 rate_key TEXT PRIMARY KEY, window_started_at TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0
);
