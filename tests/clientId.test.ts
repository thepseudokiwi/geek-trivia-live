import { afterEach, expect, it, vi } from 'vitest';
import { clientId } from '../src/clientId.js';

afterEach(() => vi.unstubAllGlobals());
it('generates valid unique command identifiers on external HTTP without randomUUID', () => {
  const getRandomValues = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
  vi.stubGlobal('crypto', { getRandomValues });
  const ids = Array.from({length:100}, () => clientId());
  expect(new Set(ids).size).toBe(100);
  for(const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
