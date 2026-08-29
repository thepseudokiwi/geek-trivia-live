import { createAuthClient } from '@neondatabase/auth';
import { BetterAuthReactAdapter } from '@neondatabase/auth/react/adapters';

const authUrl = import.meta.env.VITE_NEON_AUTH_URL?.trim();

export const playerAuthConfigured = Boolean(authUrl);
export const playerAuthClient = authUrl
  ? createAuthClient(authUrl, { adapter: BetterAuthReactAdapter() })
  : null;

export const playerAccountReturnUrl = () => `${location.origin}${location.pathname}#account`;
