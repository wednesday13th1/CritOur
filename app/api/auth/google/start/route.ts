import {env} from 'cloudflare:workers';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';
import {getAdminUser,rateLimit,sameOrigin} from '@/lib/admin-auth';
import {digest} from '@/lib/workspace-security';
import {normalizeGmail,pkceChallenge,randomToken} from '@/lib/google-identity';
import {GOOGLE_FLOW_COOKIE,googleReady,authBase,callbackUrl} from '@/lib/google-auth';
export const dynamic='force-dynamic';
export async function POST(req:Request){
 if(!sameOrigin(req))return NextResponse.json({error:'Invalid origin'},{status:403});
 if(!googleReady())return NextResponse.redirect(new URL('/admin/login?error=setup',req.url),303);
 try{
 if(new URL(req.url).origin!==authBase())throw Error('Invalid origin');
 await rateLimit('google-start:'+String(req.headers.get('cf-connecting-ip')||'local'),20);
 const form=await req.formData(),email=normalizeGmail(form.get('email'));if(!email)throw Error('Invalid Gmail');
 const reauthenticate=form.get('reauthenticate')==='true',user=reauthenticate?await getAdminUser():null;
 if(reauthenticate&&(!user||user.email!==email))throw Error('Invalid reauthentication');
 const state=randomToken(),verifier=randomToken(),nonce=randomToken();
 const jar=await cookies(),previous=jar.get(GOOGLE_FLOW_COOKIE)?.value;
 if(previous)await env.DB!.prepare('DELETE FROM google_login_flows WHERE token_hash=?').bind(await digest(previous)).run();
 await env.DB!.prepare('INSERT INTO google_login_flows(token_hash,email,verifier,nonce,expires_at,reauth_account_id)VALUES(?,?,?,?,?,?)').bind(await digest(state),email,verifier,nonce,Date.now()+600000,user?.accountId||null).run();
 const target=new URL('https://accounts.google.com/o/oauth2/v2/auth');
 const params={client_id:env.GOOGLE_CLIENT_ID!,redirect_uri:callbackUrl(),response_type:'code',scope:'openid email profile',state,nonce,login_hint:email,prompt:'select_account',code_challenge:await pkceChallenge(verifier),code_challenge_method:'S256'};
 for(const [k,v] of Object.entries(params))target.searchParams.set(k,v);
 const response=NextResponse.redirect(target,303);response.cookies.set(GOOGLE_FLOW_COOKIE,state,{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:600});response.headers.set('Cache-Control','no-store');response.headers.set('Referrer-Policy','no-referrer');return response;
 }catch{return NextResponse.redirect(new URL('/admin/login?error=authentication',req.url),303);}
}
