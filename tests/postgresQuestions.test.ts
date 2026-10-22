import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ query: vi.fn(), transaction: vi.fn(async (work: () => Promise<unknown>) => work()) }));
vi.mock('../server/db/postgres/gameStore.js', () => ({ gameQuery: mocks.query, gameTransaction: mocks.transaction }));
import { duplicateQuestion, listQuestions, updateQuestion } from '../server/db/postgres/questions.js';
const row = { id: 'q1', category: 'Star Trek', subcategory: 'TNG', difficulty: 2, question_text: 'Test question', correct_answer: 'Answer', alternate_answers: '["Alternative"]', question_type: 'text', media_path: null, host_notes: '', source: 'Test work', active: 1, used_count: 5, date_last_used: '2026-01-01', episode_last_used: 'e1', created_at: '2026-01-01', updated_at: '2026-01-01' };
beforeEach(() => { vi.clearAllMocks(); mocks.query.mockReset(); });

it('parameterizes search and combines false-active and unused filters', async () => {
  mocks.query.mockResolvedValue([]);
  await listQuestions({ search: "' OR 1=1 --", category: 'Star Trek', active: false, usage: 'unused' });
  const [sql, values] = mocks.query.mock.calls[0];
  expect(sql).not.toContain("' OR 1=1 --");
  expect(sql).toContain('active=$3');
  expect(sql).toContain('used_count=0');
  expect(values).toEqual(["%' OR 1=1 --%", 'Star Trek', 0]);
});

it('resets usage when duplicating but retains question content', async () => {
  mocks.query.mockResolvedValueOnce([row]).mockResolvedValueOnce([{ ...row, id: 'q2', used_count: 0, date_last_used: null, episode_last_used: null }]);
  const copy = await duplicateQuestion('q1', 'q2');
  expect(copy).toMatchObject({ id: 'q2', pointValue: 200, alternateAnswers: ['Alternative'], usedCount: 0, dateLastUsed: null, episodeLastUsed: null });
  expect(mocks.query.mock.calls[1][1].slice(-3)).toEqual([0, null, null]);
  expect(mocks.transaction).toHaveBeenCalledTimes(1);
});

it('rejects attempts to rename a question without issuing any SQL', async () => {
  await expect(updateQuestion('q1', { id: 'q2' } as any)).rejects.toThrow('Question ID cannot be changed.');
  expect(mocks.query).not.toHaveBeenCalled();
});
