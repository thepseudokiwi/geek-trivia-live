import { useEffect, useState } from 'react';

type User={id:string;email:string;displayName:string;role:'administrator'|'host';disabled:boolean};
type Invitation={id:string;email:string;role:string;kind:string;expiresAt:number};
async function request(path:string,method='GET',body?:unknown){
 const response=await fetch(path,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 const data=response.status===204?null:await response.json();
 if(!response.ok)throw new Error(data?.error??'Unable to update access.');
 return data;
}
export function RoleAdmin(){
 const [users,setUsers]=useState<User[]>([]),[invitations,setInvitations]=useState<Invitation[]>([]),[email,setEmail]=useState(''),[role,setRole]=useState('host'),[error,setError]=useState(''),[link,setLink]=useState(''),[busy,setBusy]=useState(false),[me,setMe]=useState<User|null>(null),[loading,setLoading]=useState(true);
 const refresh=async()=>{const data=await request('/api/admin/users');setUsers(data.users);setInvitations(data.invitations)};
 useEffect(()=>{void request('/api/auth/session').then(async session=>{setMe(session.user);if(session.user?.role==='administrator')await refresh();}).catch(problem=>setError(problem.message)).finally(()=>setLoading(false))},[]);
 const perform=async(fn:()=>Promise<void>)=>{setBusy(true);setError('');try{await fn();await refresh()}catch(problem){setError((problem as Error).message)}finally{setBusy(false)}};
 const invite=async(targetEmail=email,targetRole=role,kind='invite')=>{const data=await request('/api/admin/invitations','POST',{email:targetEmail,role:targetRole,kind});setLink(`${location.origin}${location.pathname}#admin-setup/${data.token}`);setEmail('')};
 if(loading)return <main><h1>Access Management</h1><p>Loading accounts…</p></main>;
 if(me?.role!=='administrator')return <main><h1>Access Management</h1><p>{error||'Administrator access is required. If this is the initial setup, use the private setup link supplied by your server administrator.'}</p></main>;
 return <main className="admin-accounts"><h1>Access Management</h1><p>Invite-only backend access. Contestant accounts are separate. Signed in as {me.email}.</p>
 {error&&<p className="error" role="alert">{error}</p>}
 <section><h2>Invite a user</h2><form className="actions" onSubmit={event=>{event.preventDefault();void perform(()=>invite())}}><label>Email <input type="email" required value={email} onChange={event=>setEmail(event.target.value)} autoComplete="off"/></label><label>Role <select value={role} onChange={event=>setRole(event.target.value)}><option value="host">Host</option><option value="administrator">Administrator</option></select></label><button disabled={busy||!email}>Create invitation</button></form><p>Hosts can run shows and manage content. Administrators can also manage accounts.</p></section>
 {link&&<section role="status"><h2>Private setup link</h2><p>Share this link privately with the intended recipient. Password resets expire in one hour; invitations expire in 48 hours. Each link works once. No email has been sent.</p><input aria-label="Private setup link" readOnly value={link} style={{width:'100%'}} onFocus={event=>event.target.select()}/><button onClick={()=>setLink('')}>Hide link</button></section>}
 <section><h2>Users</h2><div className="table-wrap"><table><thead><tr><th>Name / email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead><tbody>{users.map(user=><tr key={user.id}><td>{user.displayName}<br/>{user.email}{user.id===me.id?' (you)':''}</td><td><select aria-label={`Role for ${user.email}`} value={user.role} disabled={busy} onChange={event=>{const value=event.target.value;if(confirm(`Change ${user.email} to ${value}? Their current sessions will end.`))void perform(async()=>{await request(`/api/admin/users/${user.id}`,'PATCH',{role:value})})}}><option value="host">Host</option><option value="administrator">Administrator</option></select></td><td>{user.disabled?'Disabled':'Active'}</td><td><button disabled={busy||user.id===me.id} onClick={()=>{if(confirm(`${user.disabled?'Enable':'Disable'} ${user.email}?`))void perform(async()=>{await request(`/api/admin/users/${user.id}`,'PATCH',{disabled:!user.disabled})})}}>{user.disabled?'Enable':'Disable'}</button> <button disabled={busy||user.disabled} onClick={()=>void perform(()=>invite(user.email,user.role,'reset'))}>Password-reset link</button></td></tr>)}</tbody></table></div></section>
 <section><h2>Pending links</h2>{invitations.length===0?<p>No pending invitations or resets.</p>:invitations.map(item=><p key={item.id}>{item.email} · {item.kind} · {item.role} · expires {new Date(item.expiresAt).toLocaleString()} <button disabled={busy} onClick={()=>void perform(async()=>{await request(`/api/admin/invitations/${item.id}`,'DELETE')})}>Revoke</button></p>)}</section></main>;
}
