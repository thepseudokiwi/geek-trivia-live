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
export type ContestantStatus='joining'|'connected'|'ready'|'not-ready'|'buzz-eligible'|'buzzed'|'locked-out'|'answering'|'correct'|'incorrect'|'stealing'|'disconnected'|'removed';
export type BuzzerState='disabled'|'armed'|'open'|'locked'|'answering'|'steal-open'|'resolved'|'cancelled';
export interface ContestantProjection{showTitle:string;episodeTitle:string;displayName:string;team:string|null;score:number;connected:boolean;ready:boolean;status:ContestantStatus;buzzer:{id:string|null;state:BuzzerState;revision:number;eligible:boolean;result:'idle'|'won'|'locked-out'|'incorrect'|'correct'};question:null|{category:string;value:number;text?:string;answer?:string};responseTimer:{status:TimerStatus;remainingMs:number;durationMs:number;resumedAt:string|null;serverNow:string};hostMessage:string|null;modifier:string|null}
export interface HostContestantState{joinSession:null|{id:string;joinCode:string;status:string;expiresAt:string;maxParticipants:number;readyCheckOpen:boolean;joinUrl:string;teamMode:'individual'|'team'};contestants:Array<{sessionId:string;displayName:string;team:string|null;participantId:string;score:number;ready:boolean;status:ContestantStatus;connected:boolean;deviceCount:number;latency:'Excellent'|'Good'|'Fair'|'Poor'|'Disconnected';joinedAt:string;warning:string|null}>;buzzer:{id:string|null;state:BuzzerState;revision:number;winnerSessionId:string|null;winnerParticipantId:string|null;queue:Array<{sessionId:string;displayName:string;position:number|null;accepted:boolean;reason:string|null}>;responseTimer:{status:TimerStatus;remainingMs:number;durationMs:number;resumedAt:string|null}}}
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
export type D20Mode='question_selector'|'event_die'|'manual';
export type D20Theme='neon_arcane'|'classic_polyhedral'|'holographic_scifi';
export interface D20Effect{key:string;name:string;minRoll:number;maxRoll:number;effectType:string;scoreMultiplier:number;flatBonus:number;timerOverrideMs:number|null;stealEnabled:boolean;appliesTo:string;publicDescription:string;privateInstructions:string;active:boolean;displayPriority:number}
export interface D20Settings{enabled:boolean;mode:D20Mode;animationDurationMs:number;reducedMotionDurationMs:number;autoShowPublic:boolean;autoReturn:boolean;autoSelectQuestion:boolean;requireConfirmation:boolean;modifiersAffectDeductions:boolean;skippedEligible:boolean;speedDurationMs:number;criticalFailureConsequence:string;resultDisplayDurationMs:number;soundEnabled:boolean;volume:number;theme:D20Theme;revision:number;effects:D20Effect[]}
export interface PublicD20State{result:number;mode:Exclude<D20Mode,'manual'>;status:string;effectName:string;publicDescription:string;selectedSquare:null|{category:string;value:number};effectiveAwardXp:number|null;timerOverrideMs:number|null;stealEnabled:boolean;rolledAt:string;animationDurationMs:number;resultDisplayDurationMs:number;autoReturn:boolean;theme:D20Theme;soundEnabled:boolean;volume:number}
export interface PrivateD20State extends PublicD20State{id:string;effectKey:string|null;privateInstructions:string;selectedQuestionId:string|null;effectiveDeductionXp:number|null;configRevision:number;canApply:boolean;canCancel:boolean;canUndo:boolean}
export interface PublicLiveState{d20:PublicD20State|null}
export interface PrivateLiveState extends PublicLiveState{privateBoard:Array<{name:string;squares:Array<{id:string;value:number;status:EpisodeQuestionState;active:boolean}>}>;privateParticipants:Array<PublicParticipant&{id:string}>;activeQuestion:null|{id:string;category:string;value:number;text:string;correctAnswer:string;alternateAnswers:string[];hostNotes:string;source:string;state:EpisodeQuestionState};actions:GameAction[];control:{role:'controller'|'observer';controllerConnected:boolean;audienceCount:number};undo:null|{actionId:string;description:string;safe:boolean;reason?:string};d20Private:PrivateD20State|null;d20Settings:D20Settings;d20History:PrivateD20State[];hasActiveD20Modifier:boolean}
export type PresentationScene='standby'|'intro'|'board'|'question'|'answer'|'scores'|'d20'|'intermission'|'round-transition'|'winner'|'final'|'credits'|'custom-message';
export type PresentationLayout='full'|'overlay'|'scorebug'|'question'|'lowerthird';
export type TransitionKind='cut'|'fade'|'crossfade'|'slide-left'|'slide-right'|'slide-up'|'zoom'|'card-flip'|'wipe'|'glitch'|'iris'|'score-pulse'|'category-reveal'|'question-reveal'|'answer-reveal'|'winner-reveal';
export interface PresentationTransition{kind:TransitionKind;durationMs:number;easing:string;delayMs:number;reducedMotionFallback:TransitionKind;audioCue:string|null;backgroundHold:boolean;interrupt:'settle'|'replace'}
export interface ThemeTokens{id:string;name:string;description:string;colors:{primary:string;secondary:string;background:string;surface:string;accent:string;success:string;warning:string;error:string;text:string;muted:string};fonts:{display:string;heading:string;body:string;score:string;timer:string;question:string};shape:{radius:string;border:string;shadow:string;glow:string};motionIntensity:number;logoPlacement:string;watermarkPlacement:string;transitionDefaults:PresentationTransition}
export interface SafeAreaConfig{titleSafePercent:number;actionSafePercent:number;cameraZones:Array<{id:string;x:number;y:number;width:number;height:number}>;showGuides:boolean}
export interface AudioState{masterMuted:boolean;reducedAudio:boolean;audienceOnly:boolean;groups:Record<string,{muted:boolean;volume:number}>;cue:null|{id:string;type:string;startedAt:string;loop:boolean}}
export interface PublicPresentationState{programScene:PresentationScene;transition:PresentationTransition&{startedAt:string|null;endsAt:string|null};theme:ThemeTokens;profile:{name:string;showTitle:string;subtitle:string;logoUrl:string|null;watermarkUrl:string|null;sponsorUrl:string|null};layout:PresentationLayout;audio:AudioState;graphics:Array<{id:string;type:string;text:string;expiresAt:string|null}>;safeArea:SafeAreaConfig;customMessage:string|null;reducedMotion:boolean;animationsDisabled:boolean}
export interface PrivatePresentationState extends PublicPresentationState{previewScene:PresentationScene|null;queuedScene:PresentationScene|null;availableScenes:PresentationScene[];availableThemes:Array<{id:string;name:string}>;availableProfiles:Array<{id:string;name:string;isDefault:boolean}>;transitionStatus:'idle'|'queued'|'transitioning';assetCount:number}
export interface PublicLiveState{presentation:PublicPresentationState}
export interface PrivateLiveState{presentationPrivate:PrivatePresentationState}
export type LiveCommandType='question.select'|'question.show'|'answer.reveal'|'question.complete'|'question.skip'|'score.adjust'|'score.question'|'timer.start'|'timer.pause'|'timer.resume'|'timer.reset'|'timer.adjust'|'display.setMode'|'action.undo'|'d20.roll'|'d20.acknowledge'|'d20.apply'|'d20.cancel'|'d20.reroll'|'d20.undo'|'presentation.previewScene'|'presentation.queueScene'|'presentation.take'|'presentation.cut'|'presentation.cancelQueue'|'presentation.setTheme'|'presentation.setProfile'|'presentation.setLayout'|'presentation.triggerGraphic'|'presentation.hideGraphic'|'presentation.playCue'|'presentation.stopCue'|'presentation.setAudioState'|'presentation.setOptions'|'presentation.resync';
export interface LiveCommand{episodeId:string;commandId:string;expectedRevision:number;type:LiveCommandType;payload:Record<string,unknown>}
