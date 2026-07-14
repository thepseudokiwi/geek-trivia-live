import{describe,expect,it}from'vitest';import{validateEpisodeRecord}from'../shared/episodeValidation.js';import{generateEpisode}from'../shared/episodeGenerator.js';import type{EpisodeOptions,EpisodeRecord,Question}from'../shared/types.js';
const options:EpisodeOptions={categoryCount:4,seed:'validation',recentUsePolicy:{mode:'allow-all'}};
const library=():Question[]=>Array.from({length:4},(_,c)=>Array.from({length:5},(_,i)=>({id:`C${c+1}-D${i+1}`,category:`Category ${c+1}`,subcategory:'',difficulty:(i+1) as Question['difficulty'],pointValue:(i+1)*100,questionText:'Question',correctAnswer:'Answer',alternateAnswers:[],questionType:'text' as const,mediaPath:null,hostNotes:'',source:'',active:true,usedCount:0,dateLastUsed:null,episodeLastUsed:null}))).flat();
const record=():EpisodeRecord=>({id:'episode-1',title:'Valid episode',episodeNumber:null,scheduledDate:null,status:'locked',options,...generateEpisode(library(),options)});
describe('episode persistence validation',()=>{
 it('accepts a complete balanced board',()=>expect(()=>validateEpisodeRecord(record())).not.toThrow());
 it('rejects duplicate questions before saving or locking',()=>{const e=record();e.categories[1].questions[0]=e.categories[0].questions[0];expect(()=>validateEpisodeRecord(e)).toThrow(/unique/)});
 it('rejects incomplete boards',()=>{const e=record();e.categories[0].questions.pop();expect(()=>validateEpisodeRecord(e)).toThrow(/exactly five/)});
 it('rejects incorrect XP values',()=>{const e=record();e.categories[0].questions[0].pointValue=999;expect(()=>validateEpisodeRecord(e)).toThrow(/XP/)});
});
