import { Redis } from 'ioredis';
import crypto from 'node:crypto';

const renew = `if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('PEXPIRE', KEYS[1], ARGV[2]) else return 0 end`;
const release = `if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1]) else return 0 end`;
const ttl = 15_000;

/** Cross-instance host ownership. A stale socket cannot release a newer lease. */
export function createControllerLeases(redis: Pick<Redis, 'set' | 'get' | 'eval'>) {
  const key = (episodeId: string) => `nerd-wars:beta:controller:${encodeURIComponent(episodeId)}`;
  return {
    async claim(episodeId: string, clientId: string) {
      const token = JSON.stringify({ clientId, nonce: crypto.randomUUID() });
      const result = await redis.set(key(episodeId), token, 'PX', ttl, 'NX');
      return result === 'OK' ? token : null;
    },
    async renew(episodeId: string, token: string) {
      return Number(await redis.eval(renew, 1, key(episodeId), token, ttl)) === 1;
    },
    async release(episodeId: string, token: string) {
      return Number(await redis.eval(release, 1, key(episodeId), token)) === 1;
    },
    async owner(episodeId: string): Promise<string | null> {
      const value = await redis.get(key(episodeId));
      if (!value) return null;
      try {
        const owner = JSON.parse(value);
        return typeof owner.clientId === 'string' ? owner.clientId : null;
      } catch { return null; }
    },
  };
}
