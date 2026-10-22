import { beforeAll, afterAll, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
let repo:typeof import('../server/adminAccounts.js'),db:any;
let owner:any,host:any,ownerToken:string;
const password='a sufficiently long test password';
beforeAll(async()=>{
 const database=path.resolve(`data/test-admin-${process.pid}.db`);
 execFileSync(process.execPath,['--import','tsx','server/db/migrate.ts'],{env:{...process.env,DATABASE_PATH:database}});
 process.env.DATABASE_PATH=database;repo=await import('../server/adminAccounts.js');db=(await import('../server/db/database.js')).db;
});
afterAll(()=>db.close());
it('bootstraps only via a single-use setup token, stores hashes, and accepts email login',async()=>{
 const invite=repo.createInvitation({email:'Owner@example.com',role:'administrator'},null,true);
 expect(repo.inspectInvitation(invite.token).email).toBe('owner@example.com');
 expect(JSON.stringify(db.prepare('SELECT * FROM admin_invitations').all())).not.toContain(invite.token);
 await expect(repo.acceptInvitation(invite.token,'short','Owner')).rejects.toThrow();
 await repo.acceptInvitation(invite.token,password,'Owner');
 await expect(repo.acceptInvitation(invite.token,password,'Intruder')).rejects.toThrow(/expired/);
 expect(repo.accountsEnabled()).toBe(true);
 expect(()=>repo.createInvitation({email:'second@example.com',role:'administrator'},null,true)).toThrow(/completed/);
 expect(await repo.loginAccount('owner@example.com','wrong')).toBeNull();
 const login=await repo.loginAccount('OWNER@EXAMPLE.COM',password);owner=login!.user;ownerToken=login!.token;
 expect(repo.sessionUser(ownerToken)?.role).toBe('administrator');
 expect(JSON.stringify(db.prepare('SELECT * FROM admin_users').all())).not.toContain(password);
 expect(JSON.stringify(db.prepare('SELECT * FROM admin_sessions').all())).not.toContain(ownerToken);
});
it('prevents losing the last administrator',()=>{
 expect(()=>repo.updateAdminUser(owner.id,{role:'host'},owner.id)).toThrow(/administrator must remain/);
 expect(()=>repo.updateAdminUser(owner.id,{disabled:true},owner.id)).toThrow(/own account/);
});
it('invites hosts and immediately invalidates sessions when disabled',async()=>{
 const invite=repo.createInvitation({email:'host@example.com',role:'host'},owner.id);
 await repo.acceptInvitation(invite.token,password,'Host');
 const login=await repo.loginAccount('host@example.com',password);host=login!.user;
 expect(host.role).toBe('host');repo.updateAdminUser(host.id,{disabled:true},owner.id);
 expect(repo.sessionUser(login!.token)).toBeNull();expect(await repo.loginAccount(host.email,password)).toBeNull();
 repo.updateAdminUser(host.id,{disabled:false},owner.id);
});
it('revokes invitations and enforces expiry',()=>{
 const invite=repo.createInvitation({email:'later@example.com',role:'host'},owner.id);
 repo.revokeInvitation(invite.id,owner.id);expect(()=>repo.inspectInvitation(invite.token)).toThrow(/expired/);
 const expired=repo.createInvitation({email:'expired@example.com',role:'host'},owner.id);
 db.prepare('UPDATE admin_invitations SET expires_at=0 WHERE id=?').run(expired.id);
 expect(()=>repo.inspectInvitation(expired.token)).toThrow(/expired/);
});
it('resets passwords once, invalidates sessions, and preserves the current role',async()=>{
 const login=await repo.loginAccount(host.email,password);
 const reset=repo.createInvitation({email:host.email,role:'administrator',kind:'reset'},owner.id);
 expect(reset.expiresAt-Date.now()).toBeLessThanOrEqual(3600000);
 expect(reset.expiresAt-Date.now()).toBeGreaterThan(3500000);
 await repo.acceptInvitation(reset.token,password+' changed','Host');
 expect(repo.sessionUser(login!.token)).toBeNull();expect(await repo.loginAccount(host.email,password)).toBeNull();
 expect((await repo.loginAccount(host.email,password+' changed'))!.user.role).toBe('host');
 repo.logoutAccount(ownerToken);expect(repo.sessionUser(ownerToken)).toBeNull();
});
it('supports local recovery without changing roles and rejects expired or reused resets',async()=>{
 const old=repo.createInvitation({email:owner.email,role:'host',kind:'reset'},null);
 const reset=repo.createInvitation({email:owner.email,role:'host',kind:'reset'},null);
 expect(()=>repo.inspectInvitation(old.token)).toThrow(/expired/);
 const session=await repo.loginAccount(owner.email,password);
 await repo.acceptInvitation(reset.token,password,'Owner');
 expect(repo.sessionUser(session!.token)).toBeNull();
 expect((await repo.loginAccount(owner.email,password))!.user.role).toBe('administrator');
 await expect(repo.acceptInvitation(reset.token,password,'Owner')).rejects.toThrow(/expired/);
 const expired=repo.createInvitation({email:owner.email,role:'host',kind:'reset'},null);
 db.prepare('UPDATE admin_invitations SET expires_at=0 WHERE id=?').run(expired.id);
 await expect(repo.acceptInvitation(expired.token,password,'Owner')).rejects.toThrow(/expired/);
 expect(()=>repo.createInvitation({email:'missing@example.com',role:'host',kind:'reset'},null)).toThrow(/active account/);
 repo.updateAdminUser(host.id,{disabled:true},owner.id);
 expect(()=>repo.createInvitation({email:host.email,role:'host',kind:'reset'},null)).toThrow(/active account/);
 repo.updateAdminUser(host.id,{disabled:false},owner.id);
});
it('enforces Administrator-only management through the HTTP API',async()=>{
 const {default:express}=await import('express');
 const security=await import('../server/security.js');
 const {adminAccountRoutes}=await import('../server/adminAccountRoutes.js');
 const app=express();app.use(express.json());app.use(security.requireAllowedOrigin);security.authRoutes(app);app.use('/api',security.requireHostApi);adminAccountRoutes(app);
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
 const address=server.address()as {port:number},base=`http://127.0.0.1:${address.port}`;
 try{
  expect((await fetch(base+'/api/admin/users')).status).toBe(401);
  expect((await fetch(base+'/api/admin/invitations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:owner.email,role:'administrator',kind:'reset'})})).status).toBe(401);
  const hostLogin=await repo.loginAccount(host.email,password+' changed');
  expect((await fetch(base+'/api/admin/users',{headers:{Cookie:`nw_host=${hostLogin!.token}`}})).status).toBe(403);
  expect((await fetch(base+'/api/admin/invitations',{method:'POST',headers:{Cookie:`nw_host=${hostLogin!.token}`,'Content-Type':'application/json'},body:JSON.stringify({email:'attacker@example.com',role:'administrator'})})).status).toBe(403);
  const response=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:owner.email,password})});
  expect(response.status).toBe(200);const cookie=response.headers.get('set-cookie')!.split(';')[0];
  expect(response.headers.get('set-cookie')).toContain('HttpOnly');
  const users=await fetch(base+'/api/admin/users',{headers:{Cookie:cookie}});expect(users.status).toBe(200);
  const payload=await users.text();expect(payload).not.toContain('password_hash');expect(payload).not.toContain('token_hash');
  await fetch(base+'/api/auth/logout',{method:'POST',headers:{Cookie:cookie}});
  expect((await fetch(base+'/api/admin/users',{headers:{Cookie:cookie}})).status).toBe(401);
 }finally{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()))}
});
