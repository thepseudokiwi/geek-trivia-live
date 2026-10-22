import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { z } from 'zod';
import { db } from './db/database.js';

const derive=promisify(crypto.scrypt);
const emailSchema=z.string().trim().email().max(254).transform(value=>value.toLowerCase());
const roleSchema=z.enum(['administrator','host']);
const hash=(token:string)=>crypto.createHash('sha256').update(token).digest('hex');
export type AdminUser={id:string;email:string;displayName:string;role:'administrator'|'host';disabled:boolean};
const publicUser=(row:any):AdminUser=>({id:row.id,email:row.email,displayName:row.display_name,role:row.role,disabled:Boolean(row.disabled)});
function fail(message:string):never {throw new Error(message)}
const audit=(actor:string|null,action:string,target:string)=>db.prepare('INSERT INTO admin_audit(id,actor_id,action,target) VALUES(?,?,?,?)').run(crypto.randomUUID(),actor,action,target);
export const accountsEnabled=()=>Number((db.prepare('SELECT count(*) n FROM admin_users').get()as any).n)>0;
async function passwordHash(password:string) {
 z.string().min(15,'Use at least 15 characters.').max(128,'Use at most 128 characters.').parse(password);
 const salt=crypto.randomBytes(16).toString('hex'),key=await derive(password,salt,64)as Buffer;
 return `scrypt$${salt}$${key.toString('hex')}`;
}
export async function loginAccount(email:string,password:string){
 const row=db.prepare('SELECT * FROM admin_users WHERE email=?').get(email.trim().toLowerCase())as any;
 const [,salt,expected]=(row?.password_hash??'scrypt$invalid-user-salt$'+'0'.repeat(128)).split('$');
 const key=await derive(password.slice(0,129),salt,64)as Buffer,stored=Buffer.from(expected,'hex');
 if(!row||row.disabled||password.length>128||key.length!==stored.length||!crypto.timingSafeEqual(key,stored))return null;
 const current=db.prepare('SELECT * FROM admin_users WHERE id=?').get(row.id)as any;
 if(!current||current.disabled||current.password_hash!==row.password_hash)return null;
 const token=crypto.randomBytes(32).toString('base64url');
 db.prepare('DELETE FROM admin_sessions WHERE expires_at<=?').run(Date.now());
 db.prepare('INSERT INTO admin_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(hash(token),row.id,Date.now()+12*3600000);
 audit(row.id,'login',row.id);
 return {token,user:publicUser(current)};
}
export function sessionUser(token:string|undefined):AdminUser|null {
 if(!token)return null;
 const row=db.prepare('SELECT u.* FROM admin_sessions s JOIN admin_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.disabled=0').get(hash(token),Date.now());
 return row?publicUser(row):null;
}
export function logoutAccount(token:string|undefined){if(token)db.prepare('DELETE FROM admin_sessions WHERE token_hash=?').run(hash(token))}
export function listAdminUsers(){return db.prepare('SELECT * FROM admin_users ORDER BY email').all().map(publicUser)}
export function listInvitations(){return db.prepare('SELECT id,email,role,kind,expires_at expiresAt,created_at createdAt FROM admin_invitations WHERE used_at IS NULL AND expires_at>? ORDER BY created_at DESC').all(Date.now())}
export function createInvitation(input:{email:string;role:string;kind?:string},actor:string|null,bootstrap=false){
 const email=emailSchema.parse(input.email),role=roleSchema.parse(input.role),kind=z.enum(['invite','reset']).parse(input.kind??'invite');
 if(bootstrap&&(accountsEnabled()||role!=='administrator'||kind!=='invite'))fail('Initial setup has already been completed.');
 const existing=db.prepare('SELECT * FROM admin_users WHERE email=?').get(email)as any;
 if(kind==='invite'&&existing)fail('That account already exists. Use a password-reset link instead.');
 if(kind==='reset'&&(!existing||existing.disabled))fail('Choose an active account to reset.');
 const token=crypto.randomBytes(32).toString('base64url'),id=crypto.randomUUID(),expiresAt=Date.now()+(kind==='reset'?1:48)*3600000;
 db.prepare('UPDATE admin_invitations SET used_at=? WHERE email=? AND used_at IS NULL').run(Date.now(),email);
 db.prepare('INSERT INTO admin_invitations(id,token_hash,email,role,kind,expires_at,created_by) VALUES(?,?,?,?,?,?,?)').run(id,hash(token),email,existing?.role??role,kind,expiresAt,actor);
 audit(actor,bootstrap?'bootstrap-invitation':`${kind}-created`,email);
 return {id,token,email,expiresAt};
}
function invitation(token:string){const row=db.prepare('SELECT * FROM admin_invitations WHERE token_hash=? AND used_at IS NULL AND expires_at>?').get(hash(token),Date.now())as any;if(!row)fail('This link is invalid or expired. Ask an administrator for a new link.');return row}
export function inspectInvitation(token:string){const row=invitation(token);return {email:row.email,role:row.role,kind:row.kind}}
export async function acceptInvitation(token:string,password:string,displayName:string){
 const first=invitation(token),name=z.string().trim().min(1).max(80).parse(displayName),encoded=await passwordHash(password);
 db.exec('BEGIN IMMEDIATE');
 try {
  const row=invitation(token); // Recheck after password hashing; links are single-use.
  let id:string;
  if(row.kind==='reset'){
   const user=db.prepare('SELECT * FROM admin_users WHERE email=? AND disabled=0').get(row.email)as any;
   if(!user)fail('This account is unavailable.');id=user.id;
   db.prepare('UPDATE admin_users SET password_hash=? WHERE id=?').run(encoded,id);
   db.prepare('DELETE FROM admin_sessions WHERE user_id=?').run(id);
  }else{
   id=crypto.randomUUID();db.prepare('INSERT INTO admin_users(id,email,display_name,role,password_hash) VALUES(?,?,?,?,?)').run(id,first.email,name,row.role,encoded);
  }
  db.prepare('UPDATE admin_invitations SET used_at=? WHERE id=?').run(Date.now(),row.id);
  audit(id,`${row.kind}-accepted`,id);db.exec('COMMIT');return {email:row.email};
 }catch(error){db.exec('ROLLBACK');throw error}
}
export function updateAdminUser(id:string,input:{role?:unknown;disabled?:unknown},actor:string){
 const row=db.prepare('SELECT * FROM admin_users WHERE id=?').get(id)as any;if(!row)fail('Account not found.');
 const role=input.role===undefined?row.role:roleSchema.parse(input.role),disabled=input.disabled===undefined?Boolean(row.disabled):z.boolean().parse(input.disabled);
 if(id===actor&&disabled)fail('You cannot disable your own account.');
 if(row.role==='administrator'&&!row.disabled&&(role!=='administrator'||disabled)){
  const others=(db.prepare("SELECT count(*) n FROM admin_users WHERE role='administrator' AND disabled=0 AND id<>?").get(id)as any).n;
  if(!others)fail('At least one active administrator must remain.');
 }
 db.exec('BEGIN');try{
  db.prepare('UPDATE admin_users SET role=?,disabled=? WHERE id=?').run(role,disabled?1:0,id);
  db.prepare('DELETE FROM admin_sessions WHERE user_id=?').run(id);
  if(disabled)db.prepare('UPDATE admin_invitations SET used_at=? WHERE email=? AND used_at IS NULL').run(Date.now(),row.email);
  audit(actor,'account-updated',id);db.exec('COMMIT');
 }catch(error){db.exec('ROLLBACK');throw error}
}
export function revokeInvitation(id:string,actor:string){db.prepare('UPDATE admin_invitations SET used_at=? WHERE id=?').run(Date.now(),id);audit(actor,'invitation-revoked',id)}
