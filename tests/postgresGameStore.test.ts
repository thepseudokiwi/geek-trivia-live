import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ clients: [] as any[], connect: vi.fn(), end: vi.fn() }));
vi.mock('@neondatabase/serverless', () => ({
  neonConfig: {},
  Pool: class { connect = mock.connect; end = mock.end; },
}));
import { closeGameStore, gameEpisodeTransaction, gameQuery, gameTransaction } from '../server/db/postgres/gameStore.js';

beforeEach(() => {
  vi.stubEnv('BETA_DATABASE_URL', 'postgresql://test.invalid/game');
  mock.clients.length = 0;
  mock.connect.mockImplementation(async () => {
    const client = { query: vi.fn(async () => ({ rows: [] })), release: vi.fn() };
    mock.clients.push(client);
    return client;
  });
});
afterEach(async () => { await closeGameStore(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe('PostgreSQL game transaction ownership', () => {
  it('keeps nested repository queries on one connection until commit', async () => {
    await gameTransaction(async () => {
      await gameQuery('SELECT $1', ['first']);
      await gameTransaction(() => gameQuery('SELECT $1', ['nested']));
    });
    expect(mock.connect).toHaveBeenCalledTimes(1);
    const client = mock.clients[0];
    expect(client.query.mock.calls.map((c: any[]) => c[0])).toEqual([
      'BEGIN', 'SET LOCAL search_path TO nerd_wars_game, pg_catalog',
      "SET LOCAL statement_timeout = '15s'", 'SELECT $1', 'SELECT $1', 'COMMIT',
    ]);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('rolls back a failed scoring operation and releases the connection', async () => {
    const failure = new Error('score update rejected');
    await expect(gameTransaction(async () => { throw failure; })).rejects.toBe(failure);
    expect(mock.clients[0].query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(mock.clients[0].release).toHaveBeenCalledTimes(1);
  });

  it('does not mix simultaneous commands from independent requests', async () => {
    let releaseFirst!: () => void;
    const gate = new Promise<void>(resolve => { releaseFirst = resolve; });
    let started!: () => void;
    const firstStarted = new Promise<void>(resolve => { started = resolve; });
    const first = gameTransaction(async () => {
      started(); await gate; await gameQuery('SELECT $1', ['first']);
    });
    await firstStarted;
    await gameTransaction(() => gameQuery('SELECT $1', ['second']));
    releaseFirst(); await first;
    expect(mock.connect).toHaveBeenCalledTimes(2);
    expect(mock.clients[0].query).toHaveBeenCalledWith('SELECT $1', ['first']);
    expect(mock.clients[0].query).not.toHaveBeenCalledWith('SELECT $1', ['second']);
    expect(mock.clients[1].query).toHaveBeenCalledWith('SELECT $1', ['second']);
  });

  it('obtains a transaction-scoped episode lock before mutating the score', async () => {
    await gameEpisodeTransaction('episode-a', () => gameQuery('UPDATE scores SET score=score+1'));
    const queries = mock.clients[0].query.mock.calls;
    expect(queries[3]).toEqual(['SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', ['episode-a']]);
    expect(queries[4][0]).toBe('UPDATE scores SET score=score+1');
    expect(queries[5][0]).toBe('COMMIT');
  });
});
