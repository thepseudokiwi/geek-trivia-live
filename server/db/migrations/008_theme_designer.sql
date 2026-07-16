ALTER TABLE presentation_themes ADD COLUMN draft_json TEXT;
ALTER TABLE presentation_themes ADD COLUMN published_json TEXT;
ALTER TABLE presentation_themes ADD COLUMN status TEXT NOT NULL DEFAULT 'published' CHECK(status IN('draft','published'));
ALTER TABLE presentation_themes ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE presentation_themes ADD COLUMN published_version INTEGER;
ALTER TABLE presentation_themes ADD COLUMN published_at TEXT;

UPDATE presentation_themes
SET published_json=config_json,
    draft_json=config_json,
    published_version=1,
    published_at=CURRENT_TIMESTAMP;

CREATE TABLE theme_versions (
  id TEXT PRIMARY KEY,
  theme_id TEXT NOT NULL REFERENCES presentation_themes(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  config_json TEXT NOT NULL,
  created_by TEXT NOT NULL DEFAULT 'Local host',
  change_summary TEXT NOT NULL DEFAULT '',
  parent_version_id TEXT REFERENCES theme_versions(id),
  active_published INTEGER NOT NULL DEFAULT 0 CHECK(active_published IN(0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at TEXT,
  UNIQUE(theme_id,version_number)
);
CREATE INDEX idx_theme_versions_theme ON theme_versions(theme_id,version_number DESC);

INSERT INTO theme_versions(id,theme_id,version_number,config_json,change_summary,active_published,published_at)
SELECT lower(hex(randomblob(16))),id,1,config_json,'Initial imported presentation theme',1,CURRENT_TIMESTAMP
FROM presentation_themes;

CREATE TABLE theme_presets (
  id TEXT PRIMARY KEY,
  preset_type TEXT NOT NULL,
  name TEXT NOT NULL,
  config_json TEXT NOT NULL,
  is_builtin INTEGER NOT NULL DEFAULT 0 CHECK(is_builtin IN(0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE theme_preview_tokens (
  token_hash TEXT PRIMARY KEY,
  theme_id TEXT NOT NULL REFERENCES presentation_themes(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
