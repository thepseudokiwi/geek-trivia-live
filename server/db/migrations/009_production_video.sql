CREATE TABLE episode_video_feeds (
 id TEXT PRIMARY KEY,
 episode_id TEXT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
 label TEXT NOT NULL,
 view_url TEXT NOT NULL,
 position TEXT NOT NULL DEFAULT 'top-right' CHECK(position IN('top-left','top-right','bottom-left','bottom-right')),
 visible INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_episode_video_feeds_episode ON episode_video_feeds(episode_id,created_at);
