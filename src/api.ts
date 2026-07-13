import type { EpisodeCategory, EpisodeDraft, EpisodeOptions, EpisodeRecord, Question } from '../shared/types';
async function request<T>(url:string, init?:RequestInit):Promise<T> { const response=await fetch(url,{...init,headers:{'Content-Type':'application/json',...init?.headers}}); if(!response.ok){const body=await response.json().catch(()=>({}));throw new Error(body.error??`Request failed (${response.status})`);} return response.status===204 ? undefined as T : response.json(); }
export const api={
  questions:(filters:Record<string,string|number|boolean|undefined>={})=>request<Question[]>(`/api/questions?${new URLSearchParams(Object.entries(filters).filter(([,v])=>v!==undefined&&v!=='').map(([k,v])=>[k,String(v)])).toString()}`),
  create:(q:Question)=>request<Question>('/api/questions',{method:'POST',body:JSON.stringify(q)}),
  update:(q:Question)=>request<Question>(`/api/questions/${encodeURIComponent(q.id)}`,{method:'PUT',body:JSON.stringify(q)}),
  remove:(id:string)=>request<void>(`/api/questions/${encodeURIComponent(id)}`,{method:'DELETE'}),
  duplicate:(id:string,newId:string)=>request<Question>(`/api/questions/${encodeURIComponent(id)}/duplicate`,{method:'POST',body:JSON.stringify({id:newId})}),
  importJson:(items:Question[])=>request<{imported:number}>('/api/questions/import',{method:'POST',body:JSON.stringify(items)}),
  generate:(options:EpisodeOptions)=>request<EpisodeDraft>('/api/episodes/generate',{method:'POST',body:JSON.stringify(options)}),
  rerollQuestion:(board:EpisodeDraft,category:EpisodeCategory,difficulty:number,options:EpisodeOptions,rerollSeed:string)=>request<EpisodeCategory>('/api/episodes/reroll-question',{method:'POST',body:JSON.stringify({board,category,difficulty,options,rerollSeed})}),
  rerollCategory:(board:EpisodeDraft,index:number,options:EpisodeOptions,rerollSeed:string)=>request<EpisodeDraft>('/api/episodes/reroll-category',{method:'POST',body:JSON.stringify({board,index,options,rerollSeed})}),
  saveEpisode:(episode:EpisodeRecord)=>request<EpisodeRecord>('/api/episodes',{method:'POST',body:JSON.stringify(episode)}),
  restore:(data:unknown)=>request<{restored:boolean}>('/api/restore',{method:'POST',body:JSON.stringify(data)}),
};
