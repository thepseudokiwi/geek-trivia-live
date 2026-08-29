CREATE TYPE open_play_status AS ENUM ('scheduled', 'open', 'closed', 'cancelled');
CREATE TYPE open_play_registration_status AS ENUM ('registered', 'checked_in', 'withdrawn');

CREATE TABLE player_profiles (
  auth_user_id text PRIMARY KEY,
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 80),
  handle text UNIQUE CHECK (handle IS NULL OR handle ~ '^[A-Za-z0-9_]{3,24}$'),
  avatar_url text,
  marketing_opt_in boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE open_play_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  description text,
  venue_name text,
  starts_at timestamptz NOT NULL,
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
  capacity integer NOT NULL DEFAULT 32 CHECK (capacity BETWEEN 1 AND 500),
  status open_play_status NOT NULL DEFAULT 'scheduled',
  episode_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (registration_closes_at IS NULL OR registration_opens_at IS NULL OR registration_closes_at > registration_opens_at)
);
CREATE INDEX open_play_sessions_status_starts_idx ON open_play_sessions(status, starts_at);

CREATE TABLE open_play_registrations (
  session_id uuid NOT NULL REFERENCES open_play_sessions(id) ON DELETE CASCADE,
  auth_user_id text NOT NULL REFERENCES player_profiles(auth_user_id) ON DELETE CASCADE,
  status open_play_registration_status NOT NULL DEFAULT 'registered',
  registered_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, auth_user_id)
);
CREATE INDEX open_play_registrations_player_idx ON open_play_registrations(auth_user_id, status);

CREATE TABLE player_game_stats (
  auth_user_id text PRIMARY KEY REFERENCES player_profiles(auth_user_id) ON DELETE CASCADE,
  games_played integer NOT NULL DEFAULT 0 CHECK (games_played >= 0),
  wins integer NOT NULL DEFAULT 0 CHECK (wins BETWEEN 0 AND games_played),
  total_score integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION enforce_open_play_capacity() RETURNS trigger AS $$
DECLARE
  target open_play_sessions%ROWTYPE;
  claimed integer;
BEGIN
  IF NEW.status = 'withdrawn' THEN RETURN NEW; END IF;
  SELECT * INTO target FROM open_play_sessions WHERE id = NEW.session_id FOR UPDATE;
  IF NOT FOUND OR target.status <> 'open' THEN RAISE EXCEPTION 'Open-play registration is closed.' USING ERRCODE = 'check_violation'; END IF;
  IF target.registration_opens_at IS NOT NULL AND now() < target.registration_opens_at THEN RAISE EXCEPTION 'Open-play registration has not opened.' USING ERRCODE = 'check_violation'; END IF;
  IF target.registration_closes_at IS NOT NULL AND now() >= target.registration_closes_at THEN RAISE EXCEPTION 'Open-play registration is closed.' USING ERRCODE = 'check_violation'; END IF;
  SELECT count(*) INTO claimed FROM open_play_registrations WHERE session_id = NEW.session_id AND status <> 'withdrawn' AND auth_user_id <> NEW.auth_user_id;
  IF claimed >= target.capacity THEN RAISE EXCEPTION 'Open-play session is full.' USING ERRCODE = 'check_violation'; END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER open_play_capacity_guard
BEFORE INSERT OR UPDATE OF status ON open_play_registrations
FOR EACH ROW EXECUTE FUNCTION enforce_open_play_capacity();

ALTER TABLE player_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE open_play_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE open_play_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_game_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY player_profiles_select_own ON player_profiles FOR SELECT TO authenticated USING ((select auth.user_id()) = auth_user_id);
CREATE POLICY player_profiles_insert_own ON player_profiles FOR INSERT TO authenticated WITH CHECK ((select auth.user_id()) = auth_user_id);
CREATE POLICY player_profiles_update_own ON player_profiles FOR UPDATE TO authenticated USING ((select auth.user_id()) = auth_user_id) WITH CHECK ((select auth.user_id()) = auth_user_id);
CREATE POLICY open_sessions_public_read ON open_play_sessions FOR SELECT TO anonymous, authenticated USING (status = 'open');
CREATE POLICY registrations_select_own ON open_play_registrations FOR SELECT TO authenticated USING ((select auth.user_id()) = auth_user_id);
CREATE POLICY registrations_insert_own ON open_play_registrations FOR INSERT TO authenticated WITH CHECK ((select auth.user_id()) = auth_user_id);
CREATE POLICY registrations_update_own ON open_play_registrations FOR UPDATE TO authenticated USING ((select auth.user_id()) = auth_user_id) WITH CHECK ((select auth.user_id()) = auth_user_id);
CREATE POLICY registrations_delete_own ON open_play_registrations FOR DELETE TO authenticated USING ((select auth.user_id()) = auth_user_id);
CREATE POLICY player_stats_select_own ON player_game_stats FOR SELECT TO authenticated USING ((select auth.user_id()) = auth_user_id);

GRANT SELECT, INSERT, UPDATE ON player_profiles TO authenticated;
GRANT SELECT ON open_play_sessions TO anonymous, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON open_play_registrations TO authenticated;
GRANT SELECT ON player_game_stats TO authenticated;
