import {readJson,RequestError,noStore} from '@/lib/request-security';
import {env} from 'cloudflare:workers';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';
import {digest,hashPin,validPin} from '@/lib/workspace-security';
import {rateLimit,sameOrigin,WORKSPACE_COOKIE} from '@/lib/admin-auth';
export async function POST(req:Request){
 if(!sameOrigin(req))return NextResponse.json({error:'Invalid origin'},{status:403});
 try{
 const ip=String(req.headers.get('cf-connecting-ip')||'local');await rateLimit('code-ip:'+ip,15);
 const b=await readJson(req,4096);const name=typeof b.username==='string'?b.username.trim():'',code=typeof b.code==='string'?b.code:'';
 await rateLimit('code-name:'+ip+':'+name.toLowerCase(),5);
 if(!name||name.length>80||code.length<32||code.length>256)throw Error('ユーザー名と専用コードを確認してください。');
 const members=await env.DB!.prepare('SELECT id FROM members WHERE lower(name)=lower(?)').bind(name).all<{id:string}>();
 if(members.results.length!==1)throw Error('ユーザー名と専用コードを確認してください。');
 const memberId=members.results[0].id,hash=await digest(code),now=Date.now();
 let a=await env.DB!.prepare('SELECT id,auth_user_id,session_version FROM member_accounts WHERE public_member_id=? AND login_code_hash=? AND disabled_at IS NULL AND auth_user_id NOT LIKE ?').bind(memberId,hash,'google:%').first<{id:string;auth_user_id:string;session_version:number}>();
 if(!a){
 if(!validPin(b.pin)||b.pin!==b.confirm)throw Error('初回のみ、同じ4桁PINを2回入力してください。設定済みの場合は専用コードを確認してください。');
 const id=crypto.randomUUID(),at=new Date(now).toISOString();
 const r=await env.DB!.batch([
 env.DB!.prepare(`INSERT INTO member_accounts(id,public_member_id,auth_user_id,display_name,avatar_url,pin_hash,activated_at,created_at,login_code_hash) SELECT ?,m.id,?,m.name,m.avatar,?,?,?,? FROM members m JOIN member_activations t ON t.public_member_id=m.id WHERE m.id=? AND t.token_hash=? AND t.used_at IS NULL AND t.expires_at>?`).bind(id,id,await hashPin(b.pin),at,at,hash,memberId,hash,now),
 env.DB!.prepare('UPDATE member_activations SET used_at=? WHERE token_hash=? AND EXISTS(SELECT 1 FROM member_accounts WHERE id=?)').bind(now,hash,id)]);
 if(!r[0].meta.changes)throw Error('ユーザー名と専用コードを確認してください。');
 a={id,auth_user_id:id,session_version:1};
 }
 const token=crypto.randomUUID()+crypto.randomUUID();
 const issued=await env.DB!.prepare(`INSERT INTO workspace_sessions(token_hash,auth_user_id,purpose,version,verified_at,expires_at) SELECT ?,auth_user_id,'admin',session_version,?,? FROM member_accounts WHERE id=? AND disabled_at IS NULL AND login_code_hash=? AND session_version=?`).bind(await digest(token),now,now+43200000,a.id,hash,a.session_version).run();
 if(!issued.meta.changes)throw Error('Access revoked');
 (await cookies()).set(WORKSPACE_COOKIE,token,{httpOnly:true,secure:true,sameSite:'strict',path:'/',maxAge:43200});
 return NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return NextResponse.json({error:'ログインできませんでした。ユーザー名・専用コードを確認してください。初回は4桁PINと確認も必要です。連続試行した場合は10分後にお試しください。'},{status:e instanceof RequestError?e.status:400,headers:noStore});}
}
