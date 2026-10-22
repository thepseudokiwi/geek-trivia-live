ALTER TABLE episode_video_feeds
ADD COLUMN team_side TEXT CHECK(team_side IN ('left','right'));
