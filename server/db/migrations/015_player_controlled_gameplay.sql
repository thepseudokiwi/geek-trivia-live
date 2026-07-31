ALTER TABLE episodes ADD COLUMN controlling_participant_id TEXT REFERENCES episode_participants(id) ON DELETE SET NULL;
ALTER TABLE episodes ADD COLUMN gameplay_phase TEXT NOT NULL DEFAULT 'awaiting-control';

