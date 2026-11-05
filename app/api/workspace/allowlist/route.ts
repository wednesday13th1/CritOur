import {siteAdminUser} from '@/lib/site-access';
import {readJson} from '@/lib/request-security';
import {normalizeGmail} from "@/lib/google-identity";
import {env} from 'cloudflare:workers';
import {NextResponse} from 'next/server';
import {recentlyVerified,sameOrigin,rateLimit} from '@/lib/admin-auth';
export const dynamic='force-dynamic';
const json=(b:unknown,status=200)=>NextResponse.json(b,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){
 const user=await siteAdminUser();if(!user)return json({error:'Unauthorized'},401);
 const rows=await env.DB!.prepare(`SELECT e.email,e.public_member_id,e.created_at,e.disabled_at,m.name,CASE WHEN a.email IS NULL THEN 0 ELSE 1 END AS activated FROM allowed_emails e JOIN members m ON m.id=e.public_member_id LEFT JOIN member_accounts a ON a.email=e.email ORDER BY e.created_at`).all();
 return json({entries:rows.results,recentlyVerified:recentlyVerified(user),email:user.email});
}
export async function POST(req:Request){
 if(!sameOrigin(req))return json({error:'Invalid origin'},403);
 const user=await siteAdminUser();if(!user)return json({error:'Unauthorized'},401);
 if(!recentlyVerified(user))return json({error:'5分以内のGoogle再認証が必要です。',reauthenticate:true},403);
 try{
 await rateLimit('allowlist:'+user.accountId,30);const b:any=await readJson(req),email=String(b.email||'').trim().toLowerCase(),db=env.DB!;
 if(!normalizeGmail(email))throw Error('Invalid email');
 if(b.action==='add'){
  const id=String(b.memberId||'');const bound=await db.prepare('SELECT email FROM member_accounts WHERE public_member_id=?').bind(id).first<{email:string|null}>();
  if(bound&&bound.email!==email)throw Error('This public profile is already linked to another private account.');
  await db.prepare('INSERT INTO allowed_emails (email,public_member_id,created_at,updated_by) VALUES (?,?,?,?)').bind(email,id,new Date().toISOString(),user.accountId).run();
 }else if(b.action==='revoke'||b.action==='restore'){
  const result=await db.prepare('UPDATE allowed_emails SET disabled_at=?,updated_by=? WHERE email=?').bind(b.action==='revoke'?new Date().toISOString():null,user.accountId,email).run();if(!result.meta.changes)throw Error('Entry not found');
 }else throw Error('Invalid action');
 return json({ok:true});
 }catch(e){const error=e instanceof Error?e.message:'';return json({error:error.includes('last active Admin')?'最後の有効なAdminは無効化できません。':error.includes('UNIQUE')?'このメールまたはメンバーは登録済みです。無効化済みなら再有効化してください。':'変更できませんでした。メールとメンバーの対応を確認してください。'},400);}
}
