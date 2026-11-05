'use client';
import {useCallback,useEffect,useState} from 'react';
import {Reauthenticate} from './email-login';
async function api(path:string,body?:unknown){const r=await fetch(path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'});const j=await r.json();if(!r.ok)throw Error(j.error);return j;}
export function ApprovedEmails({members,user}:{members:any[];user:any}){
 const [data,setData]=useState<any>({entries:[]}),[error,setError]=useState(''),[email,setEmail]=useState(''),[member,setMember]=useState(''),[busy,setBusy]=useState(false);
 const refresh=useCallback(()=>api('/api/workspace/allowlist').then(setData).catch(e=>setError(e.message)),[]);
 useEffect(()=>{void refresh()},[refresh]);
 async function change(body:any){setBusy(true);setError('');try{await api('/api/workspace/allowlist',body);setEmail('');await refresh();}catch(e){setError(e instanceof Error?e.message:'Change failed');}finally{setBusy(false)}}
 return <section className="approved-emails"><h2>Approved Emails</h2><p>全員が同じAdmin権限を持ちます。無効化したアカウントは即時アクセスを失います。</p><Reauthenticate email={user.email}/>{error&&<p className="form-error" role="alert">{error}</p>}<form className="settings-form" onSubmit={e=>{e.preventDefault();void change({action:'add',email,memberId:member})}}><label className="field"><span>Approved Gmail</span><input type="email" required pattern="[^@\s]+@gmail\.com" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></label><label className="field"><span>Public member profile</span><select value={member} required onChange={e=>setMember(e.target.value)}><option value="">Choose a member</option>{members.map(m=><option value={m.id} key={m.id}>{m.name}</option>)}</select></label><button className="primary" disabled={busy}>Add approved email</button></form><div className="approved-list">{data.entries.map((entry:any)=><article key={entry.email}><div><strong>{entry.name}</strong><p>{entry.email}</p><small>{entry.disabled_at?'Revoked':entry.activated?'Activated':'Awaiting first sign-in'}</small></div><button disabled={busy} onClick={()=>change({action:entry.disabled_at?'restore':'revoke',email:entry.email})}>{entry.disabled_at?'Restore access':'Revoke access'}</button></article>)}</div><p><a href="/admin/activity">View recent security changes ↗</a></p></section>;
}
export function SecurityActivity(){
 const [logs,setLogs]=useState<any[]>([]),[error,setError]=useState(''),[more,setMore]=useState(true);
 const load=useCallback(async(before='')=>{try{const j=await api('/api/workspace/activity'+(before?'?before='+encodeURIComponent(before):''));setLogs(current=>before?[...current,...j.logs]:j.logs);setMore(j.logs.length===100);}catch(e){setError(e instanceof Error?e.message:'Unable to load history')}},[]);
 useEffect(()=>{void load()},[load]);
 return <section className="security-activity"><p>Security and website changes. 記録は追記専用です。PIN・認証コード・DM本文は記録しません。</p>{error&&<p role="alert">{error}</p>}{logs.length===0&&!error&&<p>No recorded changes yet.</p>}{logs.map(log=><article key={log.id}><div><strong>{log.action}</strong><p>{log.resource}</p><small>{log.actor_name||'Authentication service'}</small></div><time>{log.created_at}</time></article>)}{more&&logs.length>0&&<button onClick={()=>load(logs.at(-1).created_at)}>Load earlier activity</button>}</section>;
}
