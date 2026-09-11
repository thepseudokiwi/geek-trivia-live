import type { Question } from '../../../shared/types.js';
import type { QuestionFilters } from '../../questionsRepository.js';
import { gameQuery, gameTransaction } from './gameStore.js';

function question(row: any): Question {
  return { id: row.id, category: row.category, subcategory: row.subcategory,
    difficulty: row.difficulty, pointValue: row.difficulty * 100,
    questionText: row.question_text, correctAnswer: row.correct_answer,
    alternateAnswers: JSON.parse(row.alternate_answers), questionType: row.question_type,
    mediaPath: row.media_path, hostNotes: row.host_notes, source: row.source,
    active: Boolean(row.active), usedCount: row.used_count, dateLastUsed: row.date_last_used,
    episodeLastUsed: row.episode_last_used, createdAt: row.created_at, updatedAt: row.updated_at };
}
export async function listQuestions(filters: QuestionFilters = {}): Promise<Question[]> {
  const clauses: string[] = [], values: unknown[] = [];
  const parameter = (value: unknown) => { values.push(value); return `$${values.length}`; };
  if (filters.search) {
    const p = parameter(`%${filters.search}%`);
    clauses.push(`(question_text ILIKE ${p} OR correct_answer ILIKE ${p} OR id ILIKE ${p})`);
  }
  if (filters.category) clauses.push(`category=${parameter(filters.category)}`);
  if (filters.subcategory) clauses.push(`subcategory=${parameter(filters.subcategory)}`);
  if (filters.difficulty) clauses.push(`difficulty=${parameter(filters.difficulty)}`);
  if (filters.active !== undefined) clauses.push(`active=${parameter(Number(filters.active))}`);
  if (filters.usage) clauses.push(filters.usage === 'used' ? 'used_count>0' : 'used_count=0');
  const rows = await gameQuery(`SELECT * FROM questions ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''} ORDER BY category,difficulty,id`, values);
  return rows.map(question);
}
export async function getQuestion(id: string) {
  const [row] = await gameQuery('SELECT * FROM questions WHERE id=$1', [id]);
  return row ? question(row) : undefined;
}
const columns = 'id,category,subcategory,difficulty,point_value,question_text,correct_answer,alternate_answers,question_type,media_path,host_notes,source,active,used_count,date_last_used,episode_last_used'.split(',');
const values = (q: Question) => [q.id,q.category,q.subcategory,q.difficulty,q.difficulty*100,q.questionText,q.correctAnswer,JSON.stringify(q.alternateAnswers),q.questionType,q.mediaPath,q.hostNotes,q.source,Number(q.active),q.usedCount,q.dateLastUsed,q.episodeLastUsed];
export async function createQuestion(q: Question) {
  const [row] = await gameQuery(`INSERT INTO questions (${columns.join(',')}) VALUES (${columns.map((_, i) => `$${i+1}`).join(',')}) RETURNING *`, values(q));
  return question(row);
}
export async function updateQuestion(id: string, q: Question) {
  if (id !== q.id) throw new Error('Question ID cannot be changed.');
  const assignments = columns.slice(1).map((name, i) => `${name}=$${i+1}`);
  const [row] = await gameQuery(`UPDATE questions SET ${assignments.join(',')},updated_at=CURRENT_TIMESTAMP::text WHERE id=$16 RETURNING *`, [...values(q).slice(1),id]);
  if (!row) throw new Error('Question not found.');
  return question(row);
}
export async function deleteQuestion(id: string) {
  return (await gameQuery('DELETE FROM questions WHERE id=$1 RETURNING id', [id])).length > 0;
}
export async function importQuestions(items: Question[]) {
  return gameTransaction(async () => {
    for (const q of items) await createQuestion(q);
    return items.length;
  });
}
