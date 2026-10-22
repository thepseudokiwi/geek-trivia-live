type Options = {
  url: string;
  onSocket: (socket: WebSocket | null) => void;
  onState: (state: any) => void;
  onError: (message: string) => void;
  onConnected: () => void;
  onExpired: () => void;
};

// Retry transport failures, never revoked sessions or a takeover by another tab.
export function connectContestant(options: Options) {
  let stopped = false, retry: ReturnType<typeof setTimeout> | undefined;
  let current: WebSocket | null = null, attempts = 0;
  const connect = () => {
    if (stopped) return;
    const ws = new WebSocket(options.url);
    current = ws;
    options.onSocket(ws);
    ws.onmessage = event => {
      if (stopped || current !== ws) return;
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (message.event === 'state.contestant') {
        attempts = 0;
        options.onConnected();
        options.onState(message.data);
      }
      if (message.event === 'command.rejected') options.onError(message.data.message);
    };
    ws.onclose = event => {
      if (stopped || current !== ws) return;
      options.onSocket(null);
      if (event.code === 4009) {
        options.onError('This player session is open in another tab or device. Close the other player screen before refreshing this one.');
        return;
      }
      if (event.code === 1008) {
        if (event.reason === 'Session unavailable') {
          options.onExpired();
          options.onError('Your player session has expired or was removed. Please join the game again.');
        } else options.onError(event.reason || 'Connection not allowed. Please check your game link.');
        return;
      }
      options.onError('Connection lost. Reconnecting…');
      retry = setTimeout(connect, Math.min(1500 * 2 ** attempts++, 15000));
    };
  };
  connect();
  return () => {
    stopped = true;
    if (retry !== undefined) clearTimeout(retry);
    current?.close();
    options.onSocket(null);
  };
}
