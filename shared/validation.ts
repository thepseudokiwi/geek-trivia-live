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

const safeName=z.string().trim().min(1).max(40).refine(x=>!/[\p{Cc}<>]/u.test(x),'Name contains unsupported characters.');
export const contestantJoinSchema=z.object({joinCode:z.string().trim().min(4).max(12),displayName:safeName,teamName:safeName.optional(),pin:z.string().max(20).optional(),avatar:z.enum(['rocket','dragon','robot','wizard','pixel','hero']).default('rocket'),color:z.enum(['#7c3aed','#0891b2','#16a34a','#ca8a04','#dc2626','#db2777','#4f46e5','#475569']).default('#7c3aed')});
export const contestantTokenSchema=z.object({token:z.string().min(32).max(200)});
export const contestantCommandSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('contestant.ready')}),z.object({type:z.literal('contestant.notReady')}),z.object({type:z.literal('contestant.leave')}),z.object({type:z.literal('contestant.acknowledgeResult')}),
 z.object({type:z.literal('contestant.buzz'),commandId:z.string().uuid(),buzzerSessionId:z.string().uuid(),expectedRevision:z.number().int().positive(),clientTimestamp:z.string().max(40).optional(),clientSequence:z.number().int().nonnegative()})
]);
