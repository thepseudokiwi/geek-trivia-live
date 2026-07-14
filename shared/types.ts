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

export type PublicDisplayMode='standby'|'board'|'question'|'answer'|'scores'|'final';
export type TimerStatus='idle'|'running'|'paused'|'expired';
export interface LiveTimer{durationMs:number;remainingMs:number;status:TimerStatus;resumedAt:string|null;expiredAt:string|null;serverNow:string}
export interface PublicSquare{key:string;value:number;status:EpisodeQuestionState;active:boolean}
export interface PublicCategory{name:string;squares:PublicSquare[]}
export interface PublicParticipant{displayName:string;color:string|null;score:number;placement:number|null}
export interface PublicLiveState{episodeId:string;title:string;status:EpisodeStatus;revision:number;mode:PublicDisplayMode;board:PublicCategory[];question:null|{category:string;value:number;text:string;answer?:string};timer:LiveTimer;participants:PublicParticipant[];message:string|null}
export interface PrivateLiveState extends PublicLiveState{privateBoard:Array<{name:string;squares:Array<{id:string;value:number;status:EpisodeQuestionState;active:boolean}>}>;privateParticipants:Array<PublicParticipant&{id:string}>;activeQuestion:null|{id:string;category:string;value:number;text:string;correctAnswer:string;alternateAnswers:string[];hostNotes:string;source:string;state:EpisodeQuestionState};actions:GameAction[];control:{role:'controller'|'observer';controllerConnected:boolean;audienceCount:number};undo:null|{actionId:string;description:string;safe:boolean;reason?:string}}
export type LiveCommandType='question.select'|'question.show'|'answer.reveal'|'question.complete'|'question.skip'|'score.adjust'|'timer.start'|'timer.pause'|'timer.resume'|'timer.reset'|'timer.adjust'|'display.setMode'|'action.undo';
export interface LiveCommand{episodeId:string;commandId:string;expectedRevision:number;type:LiveCommandType;payload:Record<string,unknown>}
