import crypto from 'node:crypto';
import {z} from 'zod';
import {db} from './db/database.js';
import {LifecycleError} from './episodesRepository.js';
import type{ProductionVideoFeed}from'../shared/types.js';

const position=z.enum(['top-left','top-right','bottom-left','bottom-right']);
const inputSchema=z.object({label:z.string().trim().min(1).max(80),viewUrl:z.string().url().max(1000),position:position.default('top-right'),visible:z.boolean().default(false),participantId:z.string().min(1).max(100).nullable().default(null),teamSide:z.enum(['left','right']).nullable().default(null)});
const randomId=()=>{const bytes=crypto.randomBytes(16);bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const value=bytes.toString('hex');return`${value.slice(0,8)}-${value.slice(8,12)}-${value.slice(12,16)}-${value.slice(16,20)}-${value.slice(20)}`};

export function normalizedVdoViewUrl(raw:string){
 const url=new URL(raw),host=url.hostname.toLowerCase();
 if(url.protocol!=='https:'||!(host==='vdo.ninja'||host.endsWith('.vdo.ninja')))throw new LifecycleError('INVALID_VIDEO_URL','Use an HTTPS VDO.Ninja view link.');
 if(!url.searchParams.get('view')||url.searchParams.has('push'))throw new LifecycleError('INVALID_VIDEO_URL','Use a VDO.Ninja view link containing ?view=, not a participant push link.');
 url.searchParams.set('cleanoutput','');url.searchParams.delete('noaudio');url.searchParams.set('autoplay','');
 return url.toString();
}
const map=(row:any):ProductionVideoFeed=>({id:row.id,label:row.label,viewUrl:row.view_url,position:row.position,visible:Boolean(row.visible),participantId:row.participant_id??null,participantName:row.participant_name??null,teamSide:row.team_side??null});
const episode=(id:string)=>{if(!db.prepare('SELECT 1 FROM episodes WHERE id=?').get(id))throw new LifecycleError('EPISODE_NOT_FOUND','Episode not found.')};
export function listVideoFeeds(episodeId:string){episode(episodeId);return(db.prepare('SELECT vf.*,ep.display_name participant_name FROM episode_video_feeds vf LEFT JOIN episode_participants ep ON ep.id=vf.participant_id WHERE vf.episode_id=? ORDER BY CASE WHEN vf.participant_id IS NULL THEN 1 ELSE 0 END,ep.created_at,vf.created_at,vf.id').all(episodeId)as any[]).map(map)}
export function saveVideoFeed(episodeId:string,input:unknown,id?:string){episode(episodeId);const parsed=inputSchema.parse(input),feedId=id??randomId(),url=normalizedVdoViewUrl(parsed.viewUrl);if(parsed.participantId&&!db.prepare('SELECT 1 FROM episode_participants WHERE id=? AND episode_id=?').get(parsed.participantId,episodeId))throw new LifecycleError('PARTICIPANT_NOT_FOUND','The selected contestant or team is not part of this episode.');if(id&&!db.prepare('SELECT 1 FROM episode_video_feeds WHERE id=? AND episode_id=?').get(id,episodeId))throw new LifecycleError('VIDEO_FEED_NOT_FOUND','Video feed not found.');db.prepare(`INSERT INTO episode_video_feeds(id,episode_id,label,view_url,position,visible,participant_id,team_side) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET label=excluded.label,view_url=excluded.view_url,position=excluded.position,visible=excluded.visible,participant_id=excluded.participant_id,team_side=excluded.team_side,updated_at=CURRENT_TIMESTAMP`).run(feedId,episodeId,parsed.label,url,parsed.position,parsed.visible?1:0,parsed.participantId,parsed.teamSide);return listVideoFeeds(episodeId)}
export function deleteVideoFeed(episodeId:string,id:string){const result=db.prepare('DELETE FROM episode_video_feeds WHERE episode_id=? AND id=?').run(episodeId,id);if(!result.changes)throw new LifecycleError('VIDEO_FEED_NOT_FOUND','Video feed not found.');return listVideoFeeds(episodeId)}
export function exportVideoFeeds(){return db.prepare('SELECT * FROM episode_video_feeds').all()}
export function restoreVideoFeeds(rows:unknown){if(!Array.isArray(rows))return;db.exec('BEGIN');try{for(const row of rows as any[]){const keys=Object.keys(row);db.prepare(`INSERT OR REPLACE INTO episode_video_feeds(${keys.join(',')}) VALUES(${keys.map(()=>'?').join(',')})`).run(...keys.map(key=>row[key]))}db.exec('COMMIT')}catch(error){db.exec('ROLLBACK');throw error}}
