CREATE TYPE account_role AS ENUM ('player', 'host', 'administrator');

CREATE TABLE account_roles (
  auth_user_id text PRIMARY KEY,
  role account_role NOT NULL,
  granted_by text,
  granted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE account_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION current_account_role() RETURNS account_role
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.account_roles WHERE auth_user_id = (SELECT auth.user_id())),
    'player'::public.account_role
  );
$$;

REVOKE ALL ON FUNCTION current_account_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION current_account_role() TO authenticated;

CREATE POLICY account_roles_select_self_or_admin ON account_roles
FOR SELECT TO authenticated
USING (auth_user_id = (SELECT auth.user_id()) OR (SELECT public.current_account_role()) = 'administrator');

GRANT SELECT ON account_roles TO authenticated;

CREATE OR REPLACE FUNCTION list_role_accounts()
RETURNS TABLE(auth_user_id text, display_name text, email text, role account_role)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT public.current_account_role()) <> 'administrator' THEN
    RAISE EXCEPTION 'Administrator access required.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN QUERY
    SELECT users.id::text,
           COALESCE(NULLIF(users.name, ''), users.email)::text,
           users.email::text,
           COALESCE(roles.role, 'player'::public.account_role)
    FROM neon_auth."user" AS users
    LEFT JOIN public.account_roles AS roles ON roles.auth_user_id = users.id::text
    ORDER BY lower(users.email);
END;
$$;

CREATE OR REPLACE FUNCTION set_account_role(target_auth_user_id text, target_role account_role)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor text := (SELECT auth.user_id());
  current_target_role public.account_role;
BEGIN
  IF (SELECT public.current_account_role()) <> 'administrator' THEN
    RAISE EXCEPTION 'Administrator access required.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM neon_auth."user" WHERE id::text = target_auth_user_id) THEN
    RAISE EXCEPTION 'Account not found.' USING ERRCODE = 'no_data_found';
  END IF;
  SELECT role INTO current_target_role FROM public.account_roles WHERE auth_user_id = target_auth_user_id;
  IF current_target_role = 'administrator' AND target_role <> 'administrator'
     AND (SELECT count(*) FROM public.account_roles WHERE role = 'administrator') <= 1 THEN
    RAISE EXCEPTION 'The final Administrator cannot be removed.' USING ERRCODE = 'check_violation';
  END IF;
  IF target_role = 'player' THEN
    DELETE FROM public.account_roles WHERE auth_user_id = target_auth_user_id;
  ELSE
    INSERT INTO public.account_roles(auth_user_id, role, granted_by)
    VALUES (target_auth_user_id, target_role, actor)
    ON CONFLICT (auth_user_id) DO UPDATE
      SET role = EXCLUDED.role, granted_by = actor, updated_at = now();
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION list_role_accounts() FROM PUBLIC;
REVOKE ALL ON FUNCTION set_account_role(text, account_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_role_accounts() TO authenticated;
GRANT EXECUTE ON FUNCTION set_account_role(text, account_role) TO authenticated;

-- Bootstrap the first Administrator after this migration with a privileged
-- database connection. Do not expose this operation through the Data API:
-- INSERT INTO account_roles(auth_user_id, role)
-- SELECT id::text, 'administrator' FROM neon_auth."user" WHERE lower(email) = lower('owner@example.com');
