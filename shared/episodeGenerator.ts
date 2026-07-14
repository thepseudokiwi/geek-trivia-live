import type { Difficulty, EpisodeCategory, EpisodeDraft, EpisodeOptions, Question } from './types.js';
import type { RandomSource } from './random.js';
import { seededRandom, shuffle } from './random.js';

export class EpisodeGenerationError extends Error {code='EPISODE_GENERATION_FAILED' as const;constructor(message:string,public details?:Record<string,unknown>){super(message);this.name='EpisodeGenerationError'}}
export const xpForDifficulty = (difficulty: Difficulty) => difficulty * 100;

function allowed(q: Question, options: EpisodeOptions) {
  if (!q.active) return false;
  const policy = options.recentUsePolicy;
  if (policy.mode === 'never-used' && q.usedCount > 0) return false;
  if (policy.mode === 'last-episodes' && q.episodeLastUsed && policy.recentEpisodeIds.slice(0, policy.count).includes(q.episodeLastUsed)) return false;
  if (policy.mode === 'last-days' && q.dateLastUsed) { const cutoff = new Date(policy.now ?? Date.now()); cutoff.setUTCDate(cutoff.getUTCDate() - policy.days); if (new Date(q.dateLastUsed) >= cutoff) return false; }
  if (options.includeCategories?.length && !options.includeCategories.includes(q.category)) return false;
  if (options.excludeCategories?.includes(q.category)) return false;
  if (options.includeFranchises?.length && !options.includeFranchises.includes(q.subcategory)) return false;
  if (options.excludeFranchises?.includes(q.subcategory)) return false;
  return true;
}

function viableCategories(questions: Question[]) {
  const grouped = new Map<string, Question[]>();
  for (const q of questions) grouped.set(q.category, [...(grouped.get(q.category) ?? []), q]);
  return [...grouped].filter(([, qs]) => [1,2,3,4,5].every(d => qs.some(q => q.difficulty === d)));
}

export function generateEpisode(questions: Question[], options: EpisodeOptions, random: RandomSource = seededRandom(options.seed)): EpisodeDraft {
  const eligible = questions.filter(q => allowed(q, options));
  const categories = viableCategories(eligible);
  if (categories.length < options.categoryCount) throw new EpisodeGenerationError(`Need ${options.categoryCount} complete categories; found ${categories.length}.`,{requiredCategories:options.categoryCount,eligibleCategories:categories.length});
  const manual = options.manualCategories ?? [];
  if (new Set(manual).size !== manual.length) throw new EpisodeGenerationError('Manual categories must be unique.');
  const byName = new Map(categories);
  const missing = manual.filter(name => !byName.has(name));
  if (missing.length) throw new EpisodeGenerationError(`Manual categories are not eligible: ${missing.join(', ')}.`);
  if (manual.length > options.categoryCount) throw new EpisodeGenerationError('Too many manual categories selected.');
  const remaining = categories.filter(([name]) => !manual.includes(name));
  const chosen = [...manual.map(name => [name, byName.get(name)!] as [string, Question[]]), ...shuffle(remaining, random).slice(0, options.categoryCount-manual.length)];
  const usedIds = new Set<string>();
  const result: EpisodeCategory[] = chosen.map(([name, pool]) => ({
    name,
    questions: ([1,2,3,4,5] as Difficulty[]).map(difficulty => {
      const choices = pool.filter(q => q.difficulty === difficulty && !usedIds.has(q.id));
      if (!choices.length) throw new EpisodeGenerationError(`No difficulty ${difficulty} question remains for ${name}.`);
      const selected = choices[Math.floor(random.next() * choices.length)];
      usedIds.add(selected.id);
      return { ...selected, pointValue: xpForDifficulty(difficulty) };
    }),
  }));
  return { seed: options.seed, categories: result };
}

export function rerollQuestion(category: EpisodeCategory, difficulty: Difficulty, library: Question[], usedIds: Set<string>, options: EpisodeOptions, random: RandomSource): EpisodeCategory {
  const current = category.questions.find(q=>q.difficulty===difficulty);
  const candidates = library.filter(q => allowed(q,options) && q.category === category.name && q.difficulty === difficulty && q.id!==current?.id && !usedIds.has(q.id));
  if (!candidates.length) throw new EpisodeGenerationError('No eligible replacement question.');
  const replacement = candidates[Math.floor(random.next() * candidates.length)];
  return { ...category, questions: category.questions.map(q => q.difficulty === difficulty ? { ...replacement, pointValue: xpForDifficulty(difficulty) } : q) };
}

export function rerollCategory(index: number, board: EpisodeDraft, library: Question[], options: EpisodeOptions, random: RandomSource): EpisodeDraft {
  if (!board.categories[index]) throw new EpisodeGenerationError('Category position does not exist.');
  const other = board.categories.filter((_,i)=>i!==index); const names=new Set(board.categories.map(c=>c.name)); const usedIds=new Set(other.flatMap(c=>c.questions.map(q=>q.id)));
  const viable=shuffle(viableCategories(library.filter(q=>allowed(q,options)&&!names.has(q.category)&&!usedIds.has(q.id))),random);
  if(!viable.length) throw new EpisodeGenerationError('No eligible replacement category with all five difficulty levels.');
  const [name,pool]=viable[0]; const questions=([1,2,3,4,5] as Difficulty[]).map(d=>{const candidates=pool.filter(q=>q.difficulty===d&&!usedIds.has(q.id));if(!candidates.length)throw new EpisodeGenerationError(`No difficulty ${d} replacement for ${name}.`);const q=candidates[Math.floor(random.next()*candidates.length)];usedIds.add(q.id);return{...q,pointValue:xpForDifficulty(d)}});
  return {...board,categories:board.categories.map((c,i)=>i===index?{name,questions}:c)};
}
