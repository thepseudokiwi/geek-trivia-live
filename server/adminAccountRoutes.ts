import type { Express, Request, Response } from 'express';
import { ZodError } from 'zod';
import * as accounts from './adminAccounts.js';
import { installAccountSecurity, requestAccount, secureAccountTransport } from './security.js';

export function adminAccountRoutes(app:Express){
 installAccountSecurity({enabled:accounts.accountsEnabled,user:accounts.sessionUser,login:accounts.loginAccount,logout:accounts.logoutAccount});
 const limited=new Map<string,{count:number;until:number}>();
 const handle=(admin:boolean,fn:(q:Request,r:Response)=>unknown)=>async(q:Request,r:Response)=>{
  r.setHeader('Cache-Control','no-store');
  if(!secureAccountTransport(q)){r.status(400).json({error:'Use HTTPS or localhost for account management.'});return}
  if(admin&&requestAccount(q)?.role!=='administrator'){r.status(403).json({error:'Administrator access required.'});return}
  if(!admin){const key=q.ip??'unknown',now=Date.now(),previous=limited.get(key),item=previous&&previous.until>now?previous:{count:0,until:now+900000};item.count++;limited.set(key,item);if(item.count>20){r.status(429).json({error:'Too many attempts. Try again later.'});return}}
  try{await fn(q,r)}catch(error){r.status(400).json({error:error instanceof ZodError?error.issues[0]?.message:error instanceof Error?error.message:'Unable to update account.'})}
 };
 app.post('/api/auth/invitation',handle(false,(q,r)=>r.json(accounts.inspectInvitation(String(q.body.token??'')))));
 app.post('/api/auth/accept-invitation',handle(false,async(q,r)=>r.json(await accounts.acceptInvitation(String(q.body.token??''),String(q.body.password??''),String(q.body.displayName??'')))));
 app.get('/api/admin/users',handle(true,(_q,r)=>r.json({users:accounts.listAdminUsers(),invitations:accounts.listInvitations()})));
 app.post('/api/admin/invitations',handle(true,(q,r)=>r.status(201).json(accounts.createInvitation(q.body,requestAccount(q)!.id))));
 app.delete('/api/admin/invitations/:id',handle(true,(q,r)=>{accounts.revokeInvitation(String(q.params.id),requestAccount(q)!.id);r.status(204).end()}));
 app.patch('/api/admin/users/:id',handle(true,(q,r)=>{accounts.updateAdminUser(String(q.params.id),q.body,requestAccount(q)!.id);r.json({ok:true})}));
}
