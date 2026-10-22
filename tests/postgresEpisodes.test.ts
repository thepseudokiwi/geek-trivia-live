import { beforeEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ query: vi.fn(), lock: vi.fn(async (_id: string, work: () => Promise<unknown>) => work()) }));
vi.mock('../server/db/postgres/gameStore.js', () => ({ gameQuery: mock.query, gameTransaction: (work: () => Promise<unknown>) => work(), gameEpisodeTransaction: mock.lock }));
import { addParticipant, completeEpisode, listEpisodes } from '../server/db/postgres/episodes.js';
beforeEach(() => { vi.clearAllMocks(); mock.query.mockReset(); });

it('rejects a ninth participant inside the episode lock', async () => {
  mock.query.mockResolvedValueOnce([{ id: 'e', status: 'in_progress' }]).mockResolvedValueOnce([{ n: '8' }]);
  await expect(addParticipant('e', { displayName: 'Ninth' })).rejects.toMatchObject({ code: 'PARTICIPANT_LIMIT' });
  expect(mock.lock).toHaveBeenCalledWith('e', expect.any(Function));
  expect(mock.query.mock.calls.some(([sql]) => sql.startsWith('INSERT'))).toBe(false);
});

it('requires confirmation before accounting an unfinished episode', async () => {
  mock.query.mockResolvedValueOnce([{ id: 'e', status: 'in_progress' }]).mockResolvedValueOnce([{ n: '3' }]);
  await expect(completeEpisode('e')).rejects.toMatchObject({ code: 'INCOMPLETE_BOARD_CONFIRMATION_REQUIRED', details: { incomplete: 3 } });
  expect(mock.query.mock.calls.some(([sql]) => sql.startsWith('UPDATE'))).toBe(false);
});

it('does not account question usage twice for an already completed episode', async () => {
  const episode = { id: 'e', status: 'completed', usage_accounted_at: '2026-01-01', options_json: '{}' };
  mock.query.mockResolvedValueOnce([episode]).mockResolvedValueOnce([episode]).mockResolvedValue([]);
  const result = await completeEpisode('e');
  expect(result.status).toBe('completed');
  expect(mock.query.mock.calls.some(([sql]) => sql.startsWith('UPDATE'))).toBe(false);
});

it('whitelists sorting and returns numeric PostgreSQL aggregate counts', async () => {
  mock.query.mockResolvedValueOnce([{ n: '2' }]).mockResolvedValueOnce([{ id: 'e', question_count: '20', progress_count: '4' }]);
  const result = await listEpisodes({ sort: 'DROP TABLE episodes', page: NaN, pageSize: Infinity });
  expect(result).toMatchObject({ total: 2, items: [{ questionCount: 20, progressCount: 4 }] });
  const [sql, values] = mock.query.mock.calls[1];
  expect(sql).toContain('ORDER BY e.updated_at DESC,e.id');
  expect(sql).not.toContain('DROP');
  expect(values).toEqual([20, 0]);
});
