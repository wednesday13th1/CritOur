import {env} from 'cloudflare:workers';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';
import {issueSession,rateLimit} from '@/lib/admin-auth';
import {digest} from '@/lib/workspace-security';
import {verifyGoogleIdentity} from '@/lib/google-identity';
import {GOOGLE_FLOW_COOKIE,googleReady,authBase,callbackUrl,bootstrapInitialAdmin,googleAccount} from '@/lib/google-auth';
import {audit} from '@/lib/audit';
export const dynamic='force-dynamic';
export async function GET(req:Request){
 const jar=await cookies(),state=jar.get(GOOGLE_FLOW_COOKIE)?.value,query=new URL(req.url).searchParams;
 const fail=()=>NextResponse.redirect(new URL('/admin/login?error=authentication',req.url),303);
 if(!googleReady()||!state||state.length>200||query.get('state')!==state||new URL(req.url).origin!==authBase())return fail();
 try{
 await rateLimit('google-callback:'+String(req.headers.get('cf-connecting-ip')||'local'),30);
 // Consume the browser-bound flow atomically before exchanging the single-use code.
 const flow=await env.DB!.prepare('DELETE FROM google_login_flows WHERE token_hash=? AND expires_at>? RETURNING *').bind(await digest(state),Date.now()).first<{email:string;verifier:string;nonce:string;reauth_account_id:string|null}>();
 jar.set(GOOGLE_FLOW_COOKIE,'',{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:0});
 const code=query.get('code');if(!flow||!code||code.length>4096||query.has('error'))throw Error('Invalid OAuth response');
 const tokenResponse=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID!,client_secret:env.GOOGLE_CLIENT_SECRET!,code,code_verifier:flow.verifier,grant_type:'authorization_code',redirect_uri:callbackUrl()}),signal:AbortSignal.timeout(15000)});
 const tokens=await tokenResponse.json() as {id_token?:string};if(!tokenResponse.ok||!tokens.id_token)throw Error('Google authentication failed');
 const identity=await verifyGoogleIdentity(tokens.id_token,env.GOOGLE_CLIENT_ID!,flow.nonce,flow.email);
 if(flow.reauth_account_id){const same=await env.DB!.prepare('SELECT id FROM member_accounts WHERE id=? AND auth_user_id=? AND email=?').bind(flow.reauth_account_id,identity.userId,identity.email).first();if(!same)throw Error('Reauthentication identity mismatch');}
 await bootstrapInitialAdmin(identity);const account=await googleAccount(identity);
 await issueSession(identity.userId,account.session_version,Date.now());await audit(flow.reauth_account_id?'auth.reauthenticated':'auth.google_login',account.id,{accountId:account.id,displayName:account.display_name});
 const response=NextResponse.redirect(new URL(flow.reauth_account_id?'/admin/settings':'/admin/dashboard',authBase()),303);response.headers.set('Cache-Control','no-store');response.headers.set('Referrer-Policy','no-referrer');return response;
 }catch{await audit('auth.google_failed','google-callback');return fail();}
}
