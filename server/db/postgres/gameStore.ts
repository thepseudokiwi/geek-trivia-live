import { AsyncLocalStorage } from 'node:async_hooks';
import { Pool, neonConfig, type PoolClient } from '@neondatabase/serverless';
import WebSocket from 'ws';

neonConfig.webSocketConstructor = WebSocket;
const sessions = new AsyncLocalStorage<PoolClient>();
let pool: Pool | undefined;

function connectionPool() {
  const connectionString = process.env.BETA_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!connectionString) throw new Error('A PostgreSQL connection is required for the game store.');
  return pool ??= new Pool({ connectionString, max: 5, connectionTimeoutMillis: 10_000, idleTimeoutMillis: 10_000 });
}

/** All game queries use numbered PostgreSQL parameters, never interpolated values. */
export async function gameQuery<Row extends Record<string, any> = Record<string, any>>(text: string, values: unknown[] = []): Promise<Row[]> {
  const client = sessions.getStore();
  if (!client) return gameTransaction(() => gameQuery<Row>(text, values));
  const result = await client.query(text, values);
  return result.rows as Row[];
}

/** One connection owns the full transaction, including nested repository calls. */
export async function gameTransaction<T>(work: () => Promise<T>): Promise<T> {
  if (sessions.getStore()) return work();
  const client = await connectionPool().connect();
  try {
    await client.query('BEGIN');
    // Fail on missing game tables instead of silently reading account tables.
    await client.query('SET LOCAL search_path TO nerd_wars_game, pg_catalog');
    await client.query("SET LOCAL statement_timeout = '15s'");
    const result = await sessions.run(client, work);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* Preserve the original failure. */ }
    throw error;
  } finally {
    client.release();
  }
}

/** Serialize a live command with its scoring, buzzer and revision updates. */
export async function gameEpisodeTransaction<T>(episodeId: string, work: () => Promise<T>): Promise<T> {
  return gameTransaction(async () => {
    // Transaction-scoped lock works across Function instances and releases on
    // connection loss. A hash collision only serializes unrelated episodes.
    await gameQuery('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [episodeId]);
    return work();
  });
}

export async function closeGameStore() {
  const current = pool;
  pool = undefined;
  await current?.end();
}
