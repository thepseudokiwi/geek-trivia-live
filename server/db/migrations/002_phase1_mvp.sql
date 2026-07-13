ALTER TABLE questions ADD COLUMN active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1));
ALTER TABLE questions ADD COLUMN used_count INTEGER NOT NULL DEFAULT 0 CHECK(used_count >= 0);
UPDATE questions SET used_count = CASE WHEN used = 1 THEN 1 ELSE 0 END;

ALTER TABLE episodes ADD COLUMN episode_number TEXT;
ALTER TABLE episodes ADD COLUMN scheduled_date TEXT;
ALTER TABLE episodes ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
UPDATE episodes SET updated_at = created_at WHERE updated_at = '';
