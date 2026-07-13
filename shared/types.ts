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
export interface EpisodeRecord extends EpisodeDraft {
  id: string; title: string; episodeNumber: string | null; scheduledDate: string | null;
  status: 'draft'|'locked'|'in_progress'|'completed'; options: EpisodeOptions;
  createdAt?: string; updatedAt?: string;
}
