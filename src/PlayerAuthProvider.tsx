import { NeonAuthUIProvider } from '@neondatabase/auth-ui';
import '@neondatabase/auth-ui/css';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { playerAuthClient } from './lib/playerAuth';
import { authHrefToHash } from './routing';

function navigate(href: string, replace = false) {
  const destination = authHrefToHash(href);
  if (!destination.startsWith('#')) {
    if (replace) location.replace(destination);
    else location.assign(destination);
    return;
  }
  if (location.search) {
    const method = replace ? 'replaceState' : 'pushState';
    history[method](null, '', `${location.pathname}${destination}`);
    dispatchEvent(new HashChangeEvent('hashchange'));
    return;
  }
  if (replace) {
    history.replaceState(null, '', `${location.pathname}${location.search}${destination}`);
    dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    location.hash = destination.slice(1);
  }
}

function HashLink({ href = '', ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const destination = authHrefToHash(href);
  return <a {...props} href={destination} />;
}

export function PlayerAuthProvider({ children }: { children: ReactNode }) {
  if (!playerAuthClient) return <>{children}</>;

  return (
    <NeonAuthUIProvider
      authClient={playerAuthClient}
      navigate={(href) => navigate(href)}
      replace={(href) => navigate(href, true)}
      Link={HashLink}
      basePath="/auth"
      redirectTo="/#account"
      social={{ providers: ['google'] }}
      defaultTheme="dark"
    >
      {children}
    </NeonAuthUIProvider>
  );
}
