import {readJson,RequestError} from '@/lib/request-security';
import {env} from 'cloudflare:workers';
import {NextResponse} from 'next/server';
import {getAdminUser,sameOrigin,rateLimit,recentlyVerified} from '@/lib/admin-auth';
import {digest} from '@/lib/workspace-security';
import {audit} from '@/lib/audit';
const json=(b:unknown,status=200)=>NextResponse.json(b,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){const u=await getAdminUser();if(!u?.isOwner)return json({error:'Owner only'},403);const r=await env.DB!.prepare(`SELECT m.id,m.name,a.activated_at,a.disabled_at,CASE WHEN a.pin_hash LIKE 'pbkdf2%' THEN 1 ELSE 0 END AS pin_set,CASE WHEN a.login_code_hash IS NULL THEN 0 ELSE 1 END AS code_set,(SELECT count(*) FROM member_activations t WHERE t.public_member_id=m.id AND t.used_at IS NULL AND t.expires_at>?) AS pending_codes FROM members m LEFT JOIN member_accounts a ON a.public_member_id=m.id ORDER BY m.display_order`).bind(Date.now()).all();return json({members:r.results});}
export async function POST(req:Request){if(!sameOrigin(req))return json({error:'Invalid origin'},403);const u=await getAdminUser();if(!u?.isOwner)return json({error:'Owner only'},403);if(!recentlyVerified(u))return json({error:'コードで再ログインしてから5分以内に操作してください。',reauthenticate:true},403);try{await rateLimit('owner:'+u.accountId,20);const b=await readJson(req,4096),id=String(b.memberId||''),db=env.DB!;
 if(!await db.prepare('SELECT id FROM members WHERE id=?').bind(id).first())throw Error('Unknown member');
 if(b.action==='issue'){
 const account=await db.prepare('SELECT id FROM member_accounts WHERE public_member_id=?').bind(id).first();if(account)throw Error('有効化済みです。ログインコード再発行を選んでください。');
 const token=crypto.randomUUID()+crypto.randomUUID(),now=Date.now();await db.batch([db.prepare('UPDATE member_activations SET used_at=? WHERE public_member_id=? AND used_at IS NULL').bind(now,id),db.prepare('INSERT INTO member_activations(id,public_member_id,token_hash,expires_at)VALUES(?,?,?,?)').bind(crypto.randomUUID(),id,await digest(token),now+604800000)]);await audit('owner.activation.issue',id,u);return json({token});
 }
 if(b.action==='rotate'){
 const token=crypto.randomUUID()+crypto.randomUUID();const result=await db.batch([db.prepare('UPDATE member_accounts SET login_code_hash=?,session_version=session_version+1 WHERE public_member_id=? AND auth_user_id NOT LIKE ?').bind(await digest(token),id,'google:%'),db.prepare('DELETE FROM workspace_sessions WHERE auth_user_id IN (SELECT auth_user_id FROM member_accounts WHERE public_member_id=?)').bind(id)]);if(!result[0].meta.changes)throw Error('コードログインのメンバーが見つかりません。');await audit('owner.code.rotate',id,u);return json({token});
 }
 if(b.action==='revoke'||b.action==='restore'){
 if(await db.prepare('SELECT 1 FROM workspace_owners WHERE public_member_id=?').bind(id).first())throw Error('オーナー自身は無効化できません。');
 await db.batch([db.prepare('UPDATE member_accounts SET disabled_at=?,session_version=session_version+1 WHERE public_member_id=?').bind(b.action==='revoke'?Date.now():null,id),db.prepare('DELETE FROM workspace_sessions WHERE auth_user_id IN(SELECT auth_user_id FROM member_accounts WHERE public_member_id=?)').bind(id)]);await audit('owner.'+b.action,id,u);return json({ok:true});
 }throw Error('Unknown action');}catch(e){return json({error:e instanceof RequestError?e.message:'変更できませんでした。対象メンバーと操作を確認してください。'},e instanceof RequestError?e.status:400);}}
