import {readJson} from '@/lib/request-security';
import {env} from 'cloudflare:workers';
import {NextResponse} from 'next/server';
import {getAdminUser,sameOrigin,rateLimit,recentlyVerified} from '@/lib/admin-auth';
import {audit} from '@/lib/audit';
export const dynamic='force-dynamic';
export async function POST(req:Request){
 const json=(b:unknown,status=200)=>NextResponse.json(b,{status,headers:{'Cache-Control':'no-store'}});
 if(!sameOrigin(req))return json({error:'Invalid origin'},403);
 try{
 const b:any=await readJson(req);
 if(b.action==='setPin'){const user=await getAdminUser();if(!user)return json({error:'Unauthorized'},401);if(!recentlyVerified(user))return json({error:'再ログインしてから5分以内にPINを変更してください。',reauthenticate:true},403);await rateLimit('pin-reset:'+user.accountId,5);const {validPin,hashPin}=await import('@/lib/workspace-security');if(!validPin(b.pin)||b.pin!==b.confirm)return json({error:'一致する安全な4桁PINを入力してください。'},400);await env.DB!.prepare('UPDATE member_accounts SET pin_hash=? WHERE id=?').bind(await hashPin(b.pin),user.accountId).run();await audit('account.pin.reset',user.accountId,user);return json({ok:true});}
 if(b.action!=='profile')return json({error:'ユーザー名と専用コードでログインしてください。'},410);
 const user=await getAdminUser();if(!user)return json({error:'Unauthorized'},401);await rateLimit('profile:'+user.accountId,30);
 const name=String(b.displayName||'').trim(),bio=String(b.bio||'').trim(),avatar=String(b.avatarUrl||'');
 if(!name||name.length>80||bio.length>500||avatar&&!/^\/media\/(?:uploads|private-uploads)\/[a-zA-Z0-9.\-]+$/.test(avatar))return json({error:'Invalid profile'},400);
 await env.DB!.prepare('UPDATE member_accounts SET display_name=?,bio=?,avatar_url=? WHERE id=?').bind(name,bio,avatar,user.accountId).run();await audit('account.profile',user.accountId,user);return json({ok:true});
 }catch{return json({error:'Unable to update profile'},400);}
}
