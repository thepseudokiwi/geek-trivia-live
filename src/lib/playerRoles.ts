import { getPlayerAuthToken } from './playerAuth';

export type AccountRole = 'player' | 'host' | 'administrator';
export type RoleAccount = { authUserId: string; displayName: string; email: string; role: AccountRole };

const dataApiUrl = import.meta.env.VITE_NEON_DATA_API_URL?.trim().replace(/\/$/, '');
export const playerRolesConfigured = Boolean(dataApiUrl);

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!dataApiUrl) throw new Error('Role management is not configured.');
  const token = await getPlayerAuthToken();
  if (!token) throw new Error('Sign in to continue.');
  const response = await fetch(`${dataApiUrl}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message ?? body.error ?? `Role request failed (${response.status}).`);
  }
  return response.status === 204 ? undefined as T : response.json();
}

export async function getMyRole(authUserId: string): Promise<AccountRole> {
  const rows = await request<Array<{ role: AccountRole }>>(`/account_roles?select=role&auth_user_id=eq.${encodeURIComponent(authUserId)}`);
  return rows[0]?.role ?? 'player';
}

export async function listRoleAccounts(): Promise<RoleAccount[]> {
  const rows = await request<Array<{ auth_user_id: string; display_name: string; email: string; role: AccountRole }>>('/rpc/list_role_accounts', { method: 'POST', body: '{}' });
  return rows.map((row) => ({ authUserId: row.auth_user_id, displayName: row.display_name, email: row.email, role: row.role }));
}

export async function setAccountRole(authUserId: string, role: AccountRole): Promise<void> {
  await request('/rpc/set_account_role', { method: 'POST', body: JSON.stringify({ target_auth_user_id: authUserId, target_role: role }) });
}
