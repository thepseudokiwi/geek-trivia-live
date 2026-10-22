import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { connectContestant } from '../src/contestantConnection.js';

class FakeSocket {
  static instances: FakeSocket[] = [];
  onmessage?: (event: { data: string }) => void;
  onclose?: (event: { code: number; reason: string }) => void;
  close = vi.fn();
  constructor(public url: string) { FakeSocket.instances.push(this); }
  end(code: number, reason = '') { this.onclose?.({ code, reason }); }
}
beforeEach(() => { vi.useFakeTimers(); FakeSocket.instances = []; vi.stubGlobal('WebSocket', FakeSocket); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
const setup = () => {
  const options = { url: 'ws://localhost/ws', onSocket: vi.fn(), onState: vi.fn(), onError: vi.fn(), onConnected: vi.fn(), onExpired: vi.fn() };
  return { options, stop: connectContestant(options) };
};
describe('contestant reconnects', () => {
  it('stops retrying expired sessions and returns to joining once', () => {
    const { options, stop } = setup();
    FakeSocket.instances[0].end(1008, 'Session unavailable');
    vi.advanceTimersByTime(60000);
    expect(FakeSocket.instances).toHaveLength(1);
    expect(options.onExpired).toHaveBeenCalledTimes(1);
    expect(options.onConnected).not.toHaveBeenCalled();
    stop();
  });
  it('does not fight another tab for the same player session', () => {
    const { options, stop } = setup();
    FakeSocket.instances[0].end(4009);
    vi.advanceTimersByTime(60000);
    expect(FakeSocket.instances).toHaveLength(1);
    expect(options.onError).toHaveBeenCalledWith(expect.stringContaining('another tab'));
    expect(options.onExpired).not.toHaveBeenCalled();
    stop();
  });
  it('backs off transport failures without clearing the error until state arrives', () => {
    const { options, stop } = setup();
    FakeSocket.instances[0].end(1006);
    vi.advanceTimersByTime(1500);
    FakeSocket.instances[1].end(1011);
    vi.advanceTimersByTime(2999);
    expect(FakeSocket.instances).toHaveLength(2);
    expect(options.onConnected).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    FakeSocket.instances[2].onmessage?.({ data: JSON.stringify({ event: 'state.contestant', data: { connected: true } }) });
    expect(options.onConnected).toHaveBeenCalledTimes(1);
    expect(options.onState).toHaveBeenCalledWith({ connected: true });
    stop();
  });
  it('cancels pending reconnects on unmount', () => {
    const { stop } = setup();
    FakeSocket.instances[0].end(1006);
    stop();
    vi.advanceTimersByTime(60000);
    expect(FakeSocket.instances).toHaveLength(1);
  });
});
