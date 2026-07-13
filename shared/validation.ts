import { z } from 'zod';
import { QUESTION_TYPES } from './types.js';

export const questionSchema = z.object({
  id: z.string().trim().min(1), category: z.string().trim().min(1), subcategory: z.string().trim().default(''),
  difficulty: z.preprocess(value => Number(value), z.union([z.literal(1),z.literal(2),z.literal(3),z.literal(4),z.literal(5)])), pointValue: z.coerce.number().int().positive(),
  questionText: z.string().trim().min(1), correctAnswer: z.string().trim().min(1),
  alternateAnswers: z.array(z.string()).default([]), questionType: z.enum(QUESTION_TYPES).default('text'),
  mediaPath: z.string().nullable().default(null), hostNotes: z.string().default(''), source: z.string().default(''),
  active: z.boolean().default(true), usedCount: z.coerce.number().int().min(0).default(0), dateLastUsed: z.string().nullable().default(null), episodeLastUsed: z.string().nullable().default(null),
});
