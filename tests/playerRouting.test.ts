import { describe, expect, it } from 'vitest';
import { authHrefToHash, isPublicPlayerRoute, parseHashRoute } from '../src/routing.js';

describe('player routes', () => {
  it('parses public account and auth routes without losing nested auth paths', () => {
    expect(parseHashRoute('#account')).toEqual({ page: 'account', id: undefined });
    expect(parseHashRoute('#auth/reset-password?token=secret')).toEqual({ page: 'auth', id: 'reset-password' });
    expect(parseHashRoute('#open-play')).toEqual({ page: 'open-play', id: undefined });
  });

  it('does not make host and administrative pages public', () => {
    expect(isPublicPlayerRoute('#auth/sign-in')).toBe(true);
    expect(isPublicPlayerRoute('#account')).toBe(true);
    expect(isPublicPlayerRoute('#open-play')).toBe(true);
    expect(isPublicPlayerRoute('#host/episode-1')).toBe(false);
    expect(isPublicPlayerRoute('#episodes')).toBe(false);
  });

  it('maps auth library navigation back into the hash router', () => {
    expect(authHrefToHash('/auth/sign-up', 'https://nerdwars.example')).toBe('#auth/sign-up');
    expect(authHrefToHash('/forgot-password', 'https://nerdwars.example')).toBe('#auth/forgot-password');
    expect(authHrefToHash('/reset-password?token=secret', 'https://nerdwars.example')).toBe('?token=secret#auth/reset-password');
    expect(authHrefToHash('/account', 'https://nerdwars.example')).toBe('#account');
    expect(authHrefToHash('https://example.org/help', 'https://nerdwars.example')).toBe('https://example.org/help');
  });
});
