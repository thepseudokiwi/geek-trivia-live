-- Run after Neon Auth and the Neon Data API are enabled. Those services create
-- the authenticated/anonymous roles and the auth.user_id() helper used below.
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
