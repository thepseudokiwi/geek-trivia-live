import { createAuthClient, createInternalNeonAuth } from '@neondatabase/auth';
import { BetterAuthReactAdapter } from '@neondatabase/auth/react/adapters';

const authUrl = import.meta.env.VITE_NEON_AUTH_URL?.trim();

export const playerAuthConfigured = Boolean(authUrl);
const internalPlayerAuth = authUrl
  ? createInternalNeonAuth(authUrl, { adapter: BetterAuthReactAdapter(), allowAnonymous: true })
  : null;
export const playerAuthClient = authUrl
  ? createAuthClient(authUrl, { adapter: BetterAuthReactAdapter() })
  : null;
export const getPlayerAuthToken = () => internalPlayerAuth?.getJWTToken() ?? Promise.resolve(null);

export const playerAccountReturnUrl = () => `${location.origin}${location.pathname}#account`;
