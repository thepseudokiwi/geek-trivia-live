import type{EpisodeRecord}from'./types.js';
export class EpisodeValidationError extends Error{code='INVALID_EPISODE' as const;constructor(message:string){super(message);this.name='EpisodeValidationError'}}
export function validateEpisodeRecord(e:EpisodeRecord):void{
 if(!e||typeof e!=='object')throw new EpisodeValidationError('Episode payload is required.');
 if(!e.id?.trim())throw new EpisodeValidationError('Episode ID is required.');if(!e.title?.trim())throw new EpisodeValidationError('Episode title is required.');if(!e.seed?.trim())throw new EpisodeValidationError('Episode seed is required.');
 if(!['draft','locked','in_progress','completed'].includes(e.status))throw new EpisodeValidationError('Episode status is invalid.');
 if(![4,5].includes(e.categories?.length))throw new EpisodeValidationError('An episode must contain exactly four or five categories.');
 if(e.options?.categoryCount!==e.categories.length)throw new EpisodeValidationError('Board size does not match the episode settings.');
 const names=e.categories.map(c=>c.name);if(names.some(n=>!n?.trim())||new Set(names).size!==names.length)throw new EpisodeValidationError('Episode categories must be named and unique.');
 const ids:string[]=[];for(const category of e.categories){if(category.questions.length!==5)throw new EpisodeValidationError(`${category.name} must contain exactly five questions.`);const levels=category.questions.map(q=>q.difficulty).sort();if(levels.join(',')!=='1,2,3,4,5')throw new EpisodeValidationError(`${category.name} must contain one question at each difficulty.`);for(const q of category.questions){if(!q.id?.trim())throw new EpisodeValidationError('Every board question must have an ID.');if(q.pointValue!==q.difficulty*100)throw new EpisodeValidationError(`${q.id} has an invalid XP value.`);ids.push(q.id)}}
 if(new Set(ids).size!==ids.length)throw new EpisodeValidationError('Episode questions must be unique.');
}
