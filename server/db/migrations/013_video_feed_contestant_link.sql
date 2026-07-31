ALTER TABLE episode_video_feeds
ADD COLUMN participant_id TEXT REFERENCES episode_participants(id) ON DELETE SET NULL;

CREATE INDEX idx_episode_video_feeds_participant
ON episode_video_feeds(episode_id, participant_id);
