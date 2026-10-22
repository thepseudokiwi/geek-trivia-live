ALTER TABLE contestant_sessions ADD COLUMN media_stream_id TEXT;
CREATE UNIQUE INDEX idx_contestant_sessions_media_stream ON contestant_sessions(media_stream_id) WHERE media_stream_id IS NOT NULL;
