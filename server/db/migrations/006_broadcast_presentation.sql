ALTER TABLE episodes ADD COLUMN presentation_profile_id TEXT;
ALTER TABLE episodes ADD COLUMN presentation_override_json TEXT;

CREATE TABLE presentation_themes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  config_json TEXT NOT NULL,
  is_builtin INTEGER NOT NULL DEFAULT 0 CHECK(is_builtin IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE branding_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  config_json TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0 CHECK(is_default IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE scene_templates (
  id TEXT PRIMARY KEY,
  scene_type TEXT NOT NULL,
  name TEXT NOT NULL,
  config_json TEXT NOT NULL,
  is_builtin INTEGER NOT NULL DEFAULT 0 CHECK(is_builtin IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE presentation_state (
  episode_id TEXT PRIMARY KEY REFERENCES episodes(id) ON DELETE CASCADE,
  program_scene TEXT NOT NULL DEFAULT 'standby',
  preview_scene TEXT,
  queued_scene TEXT,
  transition_json TEXT NOT NULL DEFAULT '{}',
  transition_started_at TEXT,
  transition_ends_at TEXT,
  theme_id TEXT NOT NULL DEFAULT 'nerd-wars-classic',
  profile_id TEXT NOT NULL DEFAULT 'nerd-wars',
  layout TEXT NOT NULL DEFAULT 'full',
  audio_json TEXT NOT NULL DEFAULT '{}',
  graphics_json TEXT NOT NULL DEFAULT '[]',
  safe_area_json TEXT NOT NULL DEFAULT '{}',
  custom_message TEXT,
  reduced_motion INTEGER NOT NULL DEFAULT 0 CHECK(reduced_motion IN (0,1)),
  animations_disabled INTEGER NOT NULL DEFAULT 0 CHECK(animations_disabled IN (0,1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE presentation_assets (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  asset_type TEXT NOT NULL,
  stored_name TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  duration_ms INTEGER,
  checksum TEXT NOT NULL,
  licensing_note TEXT NOT NULL DEFAULT '',
  attribution_note TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE audio_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  config_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE presentation_cues (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  cue_type TEXT NOT NULL,
  asset_id TEXT,
  config_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE graphic_overlays (
  id TEXT PRIMARY KEY,
  episode_id TEXT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  graphic_type TEXT NOT NULL,
  public_payload_json TEXT NOT NULL,
  visible INTEGER NOT NULL DEFAULT 1 CHECK(visible IN (0,1)),
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
