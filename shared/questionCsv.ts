import { questionSchema } from './validation.js';
import type { Question } from './types.js';

const nullable = (value: unknown) => String(value ?? '').trim() || null;
const booleanValue = (value: unknown) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized || ['true','1','yes'].includes(normalized)) return true;
  if (['false','0','no'].includes(normalized)) return false;
  return value;
};

export function csvRowToQuestion(row: Record<string, unknown>): Question {
  const difficulty = Number(row.difficulty);
  const question = questionSchema.parse({
    id: row.id, category: row.category, subcategory: row.subcategory ?? '', difficulty,
    pointValue: difficulty * 100, questionText: row.questionText, correctAnswer: row.correctAnswer,
    alternateAnswers: Array.isArray(row.alternateAnswers) ? row.alternateAnswers : String(row.alternateAnswers ?? '').split('|').map(x => x.trim()).filter(Boolean),
    questionType: String(row.questionType ?? '').trim() || 'text', mediaPath: nullable(row.mediaPath),
    hostNotes: row.hostNotes ?? '', source: row.source ?? '', active: booleanValue(row.active),
    usedCount: String(row.usedCount ?? '').trim() ? Number(row.usedCount) : 0,
    dateLastUsed: nullable(row.dateLastUsed), episodeLastUsed: nullable(row.episodeLastUsed),
  });
  validateMedia(question);
  return question;
}

export function validateMedia(question: Question) {
  const path = question.mediaPath;
  if (['image','audio','video'].includes(question.questionType) && !path) throw new Error(`mediaPath is required for ${question.questionType} questions`);
  if (!path) return;
  if (/\p{Cc}/u.test(path) || path.includes('\\') || path.split('/').includes('..') || path.startsWith('//')) throw new Error('mediaPath must be a safe URL or application-relative path');
  if (/^[a-z][a-z0-9+.-]*:/i.test(path) && !/^https?:\/\//i.test(path)) throw new Error('mediaPath only supports http(s) URLs or application-relative paths');
}

export function normalizeQuestionText(value: string) {
  return value.normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}
