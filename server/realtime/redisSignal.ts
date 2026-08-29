import crypto from 'node:crypto';
import { Redis } from 'ioredis';

const channel = 'nerd-wars:episode-invalidated:v1';

export type RealtimeSignal = { source: string; episodeId: string };

export function parseRealtimeSignal(raw: string): RealtimeSignal | null {
  try {
    const value = JSON.parse(raw) as Partial<RealtimeSignal>;
    return typeof value.source === 'string' && value.source.length > 0
      && typeof value.episodeId === 'string' && value.episodeId.length > 0
      ? { source: value.source, episodeId: value.episodeId }
      : null;
  } catch {
    return null;
  }
}

export function createRedisSignalBus(onEpisodeInvalidated: (episodeId: string) => void) {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) return null;

  const source = crypto.randomUUID();
  const publisher = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 2, enableReadyCheck: true });
  const subscriber = publisher.duplicate({ lazyConnect: true });
  const ready = Promise.all([publisher.connect(), subscriber.connect()]).then(() => subscriber.subscribe(channel)).catch((error) => {
    console.error('Realtime Redis connection failed.', error);
    throw error;
  });

  subscriber.on('message', (receivedChannel: string, raw: string) => {
    if (receivedChannel !== channel) return;
    const signal = parseRealtimeSignal(raw);
    if (signal && signal.source !== source) onEpisodeInvalidated(signal.episodeId);
  });

  return {
    publish(episodeId: string) {
      void ready.then(() => publisher.publish(channel, JSON.stringify({ source, episodeId } satisfies RealtimeSignal))).catch(() => undefined);
    },
    close() {
      void Promise.allSettled([subscriber.quit(), publisher.quit()]);
    },
  };
}
