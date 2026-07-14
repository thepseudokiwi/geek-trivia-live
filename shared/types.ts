export const QUESTION_TYPES = ['text', 'image', 'audio', 'video', 'multiple-choice'] as const;
export type QuestionType = typeof QUESTION_TYPES[number];
export type Difficulty = 1 | 2 | 3 | 4 | 5;

export interface Question {
  id: string;
  category: string;
  subcategory: string;
  difficulty: Difficulty;
  pointValue: number;
  questionText: string;
  correctAnswer: string;
  alternateAnswers: string[];
  questionType: QuestionType;
  mediaPath: string | null;
  hostNotes: string;
  source: string;
  active: boolean;
  usedCount: number;
  dateLastUsed: string | null;
  episodeLastUsed: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type RecentUsePolicy =
  | { mode: 'never-used' }
  | { mode: 'last-episodes'; count: number; recentEpisodeIds: string[] }
  | { mode: 'last-days'; days: number; now?: string }
  | { mode: 'allow-all' };

export interface EpisodeOptions {
  categoryCount: 4 | 5;
  includeCategories?: string[];
  excludeCategories?: string[];
  includeFranchises?: string[];
  excludeFranchises?: string[];
  recentUsePolicy: RecentUsePolicy;
  manualCategories?: string[];
  seed: string;
}

export interface EpisodeCategory { name: string; questions: Question[] }
export interface EpisodeDraft { seed: string; categories: EpisodeCategory[] }
export type EpisodeStatus='draft'|'locked'|'in_progress'|'completed'|'archived';
export interface EpisodeRecord extends EpisodeDraft {
  id: string; title: string; episodeNumber: string | null; scheduledDate: string | null;
  status: EpisodeStatus; options: EpisodeOptions; sourceEpisodeId?:string|null; finalWinner?:string|null;
  createdAt?: string; updatedAt?: string; startedAt?:string|null; completedAt?:string|null; archivedAt?:string|null;
}
export type EpisodeQuestionState='unopened'|'opened'|'completed'|'skipped';
export interface EpisodeQuestionGameplay{questionId:string;state:EpisodeQuestionState;openedAt:string|null;completedAt:string|null;outcome:string|null;awardedParticipantId:string|null;awardedPoints:number;notes:string|null}
export interface Participant{id:string;episodeId:string;displayName:string;color:string|null;score:number;placement:number|null;createdAt:string}
export interface GameAction{id:string;episodeId:string;actionType:string;createdAt:string;questionId:string|null;participantId:string|null;pointDelta:number;reason:string|null;metadata:Record<string,unknown>}
export interface EpisodeDetail extends EpisodeRecord{gameplay:EpisodeQuestionGameplay[];participants:Participant[];actions:GameAction[]}
export interface EpisodeSummary{id:string;title:string;episodeNumber:string|null;scheduledDate:string|null;status:EpisodeStatus;categoryCount:number;questionCount:number;progressCount:number;finalWinner:string|null;createdAt:string;updatedAt:string}
