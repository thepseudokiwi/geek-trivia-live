import { useEffect, useState } from 'react';
import { playerAuthClient } from '../lib/playerAuth';
import { getMyRole, listRoleAccounts, playerRolesConfigured, setAccountRole, type AccountRole, type RoleAccount } from '../lib/playerRoles';
import { PlayerHeader } from './PlayerAuth';

export function RoleAdmin() {
  const session = playerAuthClient?.useSession();
  const user = session?.data?.user;
  const [role, setRole] = useState<AccountRole | null>(null);
  const [accounts, setAccounts] = useState<RoleAccount[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const refresh = async () => {
    if (!user) return;
    setError('');
    try {
      const currentRole = await getMyRole(user.id);
      setRole(currentRole);
      if (currentRole === 'administrator') setAccounts(await listRoleAccounts());
    } catch (problem) { setError((problem as Error).message); }
  };
  useEffect(() => { void refresh(); }, [user?.id]);
  if (!playerRolesConfigured) return <Status title="Administration is not configured" message="Connect the Neon Data API before managing system access." />;
  if (session?.isPending) return <Status title="Loading administration" message="Checking your system permissions…" />;
  if (!user) return <Status title="Administrator sign-in required" message="Sign in with an administrator account to manage Hosts." action="#auth/sign-in" />;
  if (error && role === null) return <Status title="Unable to load permissions" message={error} />;
  if (role === null) return <Status title="Loading administration" message="Checking your system permissions…" />;
  if (role !== 'administrator') return <Status title="Administrator access required" message="Your account does not have permission to manage system roles." />;
  const changeRole = async (account: RoleAccount, nextRole: AccountRole) => {
    if (account.authUserId === user.id && nextRole !== 'administrator' && !confirm('Remove your own Administrator access? Another Administrator must exist or this will be rejected.')) return;
    if (account.role === 'administrator' && nextRole !== 'administrator' && account.authUserId !== user.id && !confirm(`Remove Administrator access from ${account.displayName || account.email}?`)) return;
    setBusy(account.authUserId); setError('');
    try { await setAccountRole(account.authUserId, nextRole); await refresh(); }
    catch (problem) { setError((problem as Error).message); }
    finally { setBusy(''); }
  };
  return <main className="player-shell role-admin-page"><PlayerHeader />
    <section className="player-hero"><p className="eyebrow">System administration</p><h1>Host access</h1><p>Players have no production controls unless an Administrator explicitly promotes them.</p></section>
    {error && <p className="player-role-error" role="alert">{error}</p>}
    <section className="player-card role-list">{accounts.map((account) => <div className="role-row" key={account.authUserId}>
      <div><strong>{account.displayName || account.email}</strong><small>{account.email}</small></div>
      <label><span className="sr-only">Role for {account.displayName || account.email}</span><select value={account.role} disabled={busy === account.authUserId} onChange={(event) => void changeRole(account, event.target.value as AccountRole)}><option value="player">Player</option><option value="host">Host</option><option value="administrator">Administrator</option></select></label>
    </div>)}</section><a className="player-button secondary" href="#account">Back to my account</a>
  </main>;
}

function Status({ title, message, action }: { title: string; message: string; action?: string }) {
  return <main className="player-shell"><PlayerHeader /><section className="player-card" role="status"><p className="eyebrow">System administration</p><h1>{title}</h1><p>{message}</p>{action && <a className="player-button" href={action}>Sign in</a>}</section></main>;
}
