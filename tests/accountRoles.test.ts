import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const migration = readFileSync(new URL('../server/db/postgres/migrations/003_account_roles.sql', import.meta.url), 'utf8');

describe('account role authorization migration', () => {
  it('defaults unassigned authenticated accounts to player', () => {
    expect(migration).toContain("'player'::public.account_role");
  });
  it('keeps role mutation behind an administrator-only security-definer function', () => {
    expect(migration).toContain("current_account_role()) <> 'administrator'");
    expect(migration).toContain('REVOKE ALL ON FUNCTION set_account_role');
    expect(migration).not.toContain('GRANT INSERT ON account_roles');
    expect(migration).not.toContain('GRANT UPDATE ON account_roles');
  });
  it('prevents removal of the final administrator', () => {
    expect(migration).toContain("count(*) FROM public.account_roles WHERE role = 'administrator'");
    expect(migration).toContain('The final Administrator cannot be removed.');
  });
});
