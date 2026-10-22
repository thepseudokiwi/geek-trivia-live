import { expect, it, vi } from 'vitest';
import { createControllerLeases } from '../server/realtime/controllerLease.js';

it('acquires only an unowned controller slot with a bounded lifetime', async () => {
  const redis = { set: vi.fn().mockResolvedValueOnce('OK').mockResolvedValueOnce(null), get: vi.fn(), eval: vi.fn() };
  const leases = createControllerLeases(redis as any);
  const token = await leases.claim('show/1', 'host-a');
  expect(JSON.parse(token!)).toMatchObject({ clientId: 'host-a' });
  expect(redis.set).toHaveBeenCalledWith('nerd-wars:beta:controller:show%2F1', token, 'PX', 15000, 'NX');
  expect(await leases.claim('show/1', 'host-b')).toBeNull();
});

it('compares the exact connection token when releasing or renewing ownership', async () => {
  const redis = { set: vi.fn(), get: vi.fn(), eval: vi.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(1) };
  const leases = createControllerLeases(redis as any);
  expect(await leases.release('show', 'stale')).toBe(false);
  expect(await leases.renew('show', 'current')).toBe(true);
  expect(redis.eval.mock.calls[0][0]).toContain("redis.call('GET', KEYS[1]) == ARGV[1]");
  expect(redis.eval.mock.calls[1].slice(1)).toEqual([1, 'nerd-wars:beta:controller:show', 'current', 15000]);
});
