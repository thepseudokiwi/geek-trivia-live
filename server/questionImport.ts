import Papa from 'papaparse';
import type { DatabaseSync } from 'node:sqlite';
import { csvRowToQuestion, normalizeQuestionText } from '../shared/questionCsv.js';
import type { Question } from '../shared/types.js';

export interface QuestionImportOptions { dryRun?: boolean; replaceExisting?: boolean; skipExisting?: boolean; deactivateMissing?: boolean }
export interface ImportIssue { row: number; id?: string; issues: string[] }
export interface DuplicateWarning { id: string; otherId: string; similarity: number; text: string }
export interface QuestionImportReport {
  totalRows:number;acceptedRows:number;rejectedRows:number;skippedRows:number;deactivatedRows:number;
  categoryCounts:Record<string,number>;difficultyCounts:Record<string,number>;duplicateWarnings:DuplicateWarning[];
  missingSourceWarnings:Array<{row:number;id:string}>;distributionWarnings:string[];errors:ImportIssue[];dryRun:boolean;committed:boolean;
}

const columns='id,category,subcategory,difficulty,point_value,question_text,correct_answer,alternate_answers,question_type,media_path,host_notes,source,active,used_count,date_last_used,episode_last_used';
const values=(q:Question)=>[q.id,q.category,q.subcategory,q.difficulty,q.difficulty*100,q.questionText,q.correctAnswer,JSON.stringify(q.alternateAnswers),q.questionType,q.mediaPath,q.hostNotes,q.source,Number(q.active),q.usedCount,q.dateLastUsed,q.episodeLastUsed];
const distance=(a:string,b:string)=>{const row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let diagonal=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const saved=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,diagonal+(a[i-1]===b[j-1]?0:1));diagonal=saved}}return row[b.length]};
const similarity=(a:string,b:string)=>Math.max(a.length,b.length)?1-distance(a,b)/Math.max(a.length,b.length):1;

export function importQuestionCsv(database:DatabaseSync,csv:string,options:QuestionImportOptions={}):QuestionImportReport {
  if(options.replaceExisting&&options.skipExisting)throw new Error('--replace-existing and --skip-existing cannot be used together.');
  const parsed=Papa.parse<Record<string,unknown>>(csv,{header:true,skipEmptyLines:'greedy',transformHeader:h=>h.trim()});
  const report:QuestionImportReport={totalRows:parsed.data.length,acceptedRows:0,rejectedRows:0,skippedRows:0,deactivatedRows:0,categoryCounts:{},difficultyCounts:{},duplicateWarnings:[],missingSourceWarnings:[],distributionWarnings:[],errors:[],dryRun:Boolean(options.dryRun),committed:false};
  for(const error of parsed.errors)report.errors.push({row:(error.row??0)+2,issues:[`CSV: ${error.message}`]});
  const questions:Array<{row:number;question:Question}>=[],ids=new Map<string,number>();
  parsed.data.forEach((raw,index)=>{const row=index+2;try{const question=csvRowToQuestion(raw);const prior=ids.get(question.id);if(prior)throw new Error(`duplicate ID also appears on row ${prior}`);ids.set(question.id,row);questions.push({row,question});if(!question.source.trim())report.missingSourceWarnings.push({row,id:question.id})}catch(error:any){report.errors.push({row,id:String(raw.id??'')||undefined,issues:error?.issues?.map((x:any)=>`${x.path.join('.')}: ${x.message}`)??[error.message]})}});
  const exact=new Map<string,{row:number;id:string}>();
  for(const item of questions){const key=normalizeQuestionText(item.question.questionText),prior=exact.get(key);if(prior)report.errors.push({row:item.row,id:item.question.id,issues:[`exact duplicate question text also appears on row ${prior.row} (${prior.id})`]});else exact.set(key,{row:item.row,id:item.question.id})}
  const existing=database.prepare('SELECT id,question_text FROM questions').all() as Array<{id:string;question_text:string}>,existingIds=new Set(existing.map(x=>x.id)),fileIds=new Set(questions.map(x=>x.question.id));
  for(const item of questions){if(existingIds.has(item.question.id)){if(options.skipExisting){report.skippedRows++;continue}if(!options.replaceExisting)report.errors.push({row:item.row,id:item.question.id,issues:['ID already exists; use --replace-existing or --skip-existing']})}const key=normalizeQuestionText(item.question.questionText),same=existing.find(x=>x.id!==item.question.id&&normalizeQuestionText(x.question_text)===key);if(same)report.errors.push({row:item.row,id:item.question.id,issues:[`exact duplicate question text already exists as ${same.id}`]})}
  const candidates=[...questions.map(x=>({id:x.question.id,text:x.question.questionText})),...existing.filter(x=>!fileIds.has(x.id)).map(x=>({id:x.id,text:x.question_text}))];
  for(let i=0;i<candidates.length;i++)for(let j=i+1;j<candidates.length;j++){const a=normalizeQuestionText(candidates[i].text),b=normalizeQuestionText(candidates[j].text);if(!a||a===b||Math.min(a.length,b.length)<20)continue;const score=similarity(a,b);if(score>=.82)report.duplicateWarnings.push({id:candidates[i].id,otherId:candidates[j].id,similarity:Number(score.toFixed(3)),text:candidates[i].text})}
  const rejectedIds=new Set(report.errors.map(x=>x.id).filter(Boolean)),accepted=questions.filter(x=>!rejectedIds.has(x.question.id)&&!(options.skipExisting&&existingIds.has(x.question.id)));
  for(const {question} of accepted){report.categoryCounts[question.category]=(report.categoryCounts[question.category]??0)+1;report.difficultyCounts[String(question.difficulty)]=(report.difficultyCounts[String(question.difficulty)]??0)+1}
  for(const category of Object.keys(report.categoryCounts).sort()){const levels=new Set(accepted.filter(x=>x.question.category===category).map(x=>x.question.difficulty)),missing=[1,2,3,4,5].filter(x=>!levels.has(x as any));if(missing.length)report.distributionWarnings.push(`${category} is missing difficulty ${missing.join(', ')}`)}
  report.rejectedRows=new Set(report.errors.map(x=>x.row)).size;report.acceptedRows=accepted.length;
  if(report.errors.length||options.dryRun)return report;
  database.exec('BEGIN');try{const insert=database.prepare(`INSERT INTO questions(${columns}) VALUES(${Array(16).fill('?').join(',')})`),update=database.prepare('UPDATE questions SET category=?,subcategory=?,difficulty=?,point_value=?,question_text=?,correct_answer=?,alternate_answers=?,question_type=?,media_path=?,host_notes=?,source=?,active=?,used_count=?,date_last_used=?,episode_last_used=?,updated_at=CURRENT_TIMESTAMP WHERE id=?');for(const{question}of accepted){if(existingIds.has(question.id))update.run(...values(question).slice(1),question.id);else insert.run(...values(question))}if(options.deactivateMissing){const present=[...fileIds];const result=present.length?database.prepare(`UPDATE questions SET active=0,updated_at=CURRENT_TIMESTAMP WHERE active=1 AND id NOT IN (${present.map(()=>'?').join(',')})`).run(...present):database.prepare('UPDATE questions SET active=0,updated_at=CURRENT_TIMESTAMP WHERE active=1').run();report.deactivatedRows=Number(result.changes)}database.exec('COMMIT');report.committed=true}catch(error){database.exec('ROLLBACK');throw error}
  return report;
}

export function questionInventory(database:DatabaseSync){const rows=database.prepare('SELECT category,difficulty,count(*) AS count FROM questions WHERE active=1 GROUP BY category,difficulty ORDER BY category,difficulty').all() as Array<{category:string;difficulty:number;count:number}>;return{total:rows.reduce((n,x)=>n+Number(x.count),0),rows}}
