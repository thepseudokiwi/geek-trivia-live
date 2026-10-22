export type AppPage =
  | 'library'
  | 'episodes'
  | 'builder'
  | 'run'
  | 'host'
  | 'audience'
  | 'play'
  | 'theme-designer'
  | 'theme-preview'
  | 'account'
  | 'auth'
  | 'open-play'
  | 'admin'
  | 'admin-setup';
// Backend setup links are separate from player registration.

export type AppView = { page: AppPage; id?: string };

const pages: ReadonlySet<string> = new Set<AppPage>([
  'library',
  'episodes',
  'builder',
  'run',
  'host',
  'audience',
  'play',
  'theme-designer',
  'theme-preview',
  'account',
  'auth',
  'open-play',
  'admin',
  'admin-setup',
]);

export function parseHashRoute(hash = location.hash): AppView {
  const route = hash.replace(/^#/, '').split('?')[0];
  const [page = 'library', ...parts] = route.split('/');
  return pages.has(page)
    ? { page: page as AppPage, id: parts.join('/') || undefined }
    : { page: 'library' };
}

export function isPublicPlayerRoute(hash = location.hash): boolean {
  return /^#(?:play(?:\/|$)|audience\/|theme-preview\/|account(?:\/|$)|auth\/|open-play(?:\/|$)|admin-setup(?:\/|$))/.test(hash);
}

export function authHrefToHash(href: string, origin = location.origin): string {
  const url = new URL(href, origin);
  const path = url.pathname.replace(/^\/+/, '');
  if (path === 'account' || path === 'open-play' || path === 'admin' || path.startsWith('auth/')) {
    return `${url.search}#${path}`;
  }
  if (/^(?:callback|email-otp|email-verification|forgot-password|magic-link|recover-account|reset-password|sign-in|sign-out|sign-up|two-factor|accept-invitation)$/.test(path)) {
    return `${url.search}#auth/${path}`;
  }
  return href;
}
