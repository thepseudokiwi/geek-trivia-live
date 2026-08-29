import { describe, expect, it } from 'vitest';
import { parseRealtimeSignal } from '../server/realtime/redisSignal.js';

describe('realtime Redis signals', () => {
  it('accepts only complete episode invalidation messages', () => {
    expect(parseRealtimeSignal('{"source":"instance-a","episodeId":"episode-1"}')).toEqual({ source: 'instance-a', episodeId: 'episode-1' });
    expect(parseRealtimeSignal('{"source":"instance-a"}')).toBeNull();
    expect(parseRealtimeSignal('not json')).toBeNull();
  });
});
