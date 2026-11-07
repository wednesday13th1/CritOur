import {env} from 'cloudflare:workers';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';
import {getAdminUser,WORKSPACE_COOKIE,sameOrigin,rateLimit,recentlyVerified} from './admin-auth';
import {readBody,RequestError} from './request-security';
import {digest} from './workspace-security';
import {pkceChallenge,randomToken} from './google-identity';
import {oauthProvider,safeReturn,verifyCritourGoogle,githubIdentity,validGithubToken,type OAuthProvider} from './critour-oauth-policy';
import {oauthAccount,oauthSession,validLinkSession} from './critour-oauth-accounts';
type OAuthFlow={verifier:string;nonce:string;return_to:string;link_account_id:string|null;link_session_hash:string|null};
export const OAUTH_COOKIE='__Host-critour-oauth-flow',LINK_COOKIE='__Host-critour-oauth-link';
const cookie={httpOnly:true,secure:true,sameSite:'lax' as const,path:'/',maxAge:600};
export function oauthEnabled(){return env.CRITOUR_OAUTH_ENABLED==='true'&&env.CODEMATE_ENABLED==='true';}
export function oauthReady(provider:OAuthProvider){return oauthEnabled()&&!!env.AUTH_BASE_URL&&(provider==='google'?!!env.GOOGLE_CLIENT_ID&&!!env.GOOGLE_CLIENT_SECRET:!!env.GITHUB_CLIENT_ID&&!!env.GITHUB_CLIENT_SECRET);}
function base(){const u=new URL(env.AUTH_BASE_URL!);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.pathname!=='/')throw new RequestError('OAuth requires a configured HTTPS origin.',503);return u.origin;}
export const oauthCallback=(provider:OAuthProvider)=>base()+'/api/auth/oauth/'+provider+'/callback';
function redirect(path:string,origin:string){const r=NextResponse.redirect(new URL(path,origin),303);r.headers.set('Cache-Control','no-store');r.headers.set('Referrer-Policy','no-referrer');return r;}
export async function startOAuth(req:Request,provider:string){
 if(!sameOrigin(req))return NextResponse.json({error:'Invalid origin'},{status:403});
 if(!oauthProvider(provider)||!oauthReady(provider))return redirect('/codemate/login?error=setup',new URL(req.url).origin);
 try{
  if(new URL(req.url).origin!==base())throw new RequestError('Use the configured sign-in address.',400);
  // General registration is enabled only after the explicit CMS grant boundary exists.
  if(!await env.DB!.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='cm_site_admins'").first())throw new RequestError('Migration is not ready.',503);
  await rateLimit('oauth-start:'+String(req.headers.get('cf-connecting-ip')||'local'),20,600000);
  const bytes=await readBody(req,2048),form=new URLSearchParams(new TextDecoder().decode(bytes));
  const linking=form.get('intent')==='link',user=linking?await getAdminUser():null;
  if(linking&&(!user||!recentlyVerified(user)||form.get('confirm')!=='yes'))throw new RequestError('Sign in again before connecting an account.',403);
  const jar=await cookies(),session=jar.get(WORKSPACE_COOKIE)?.value,state=randomToken(),verifier=randomToken(),nonce=randomToken();
  const previous=jar.get(OAUTH_COOKIE)?.value;
  await env.DB!.batch([
   env.DB!.prepare('DELETE FROM cr_oauth_flows WHERE expires_at<=? OR token_hash=?').bind(Date.now(),await digest(previous||'')),
   env.DB!.prepare('DELETE FROM cr_oauth_pending_links WHERE expires_at<=?').bind(Date.now()),
   env.DB!.prepare('INSERT INTO cr_oauth_flows(token_hash,provider,verifier,nonce,return_to,link_account_id,link_session_hash,expires_at)VALUES(?,?,?,?,?,?,?,?)').bind(await digest(state),provider,verifier,nonce,safeReturn(form.get('returnTo')),user?.accountId||null,session?await digest(session):null,Date.now()+600000)
  ]);
  const target=new URL(provider==='google'?'https://accounts.google.com/o/oauth2/v2/auth':'https://github.com/login/oauth/authorize');
  const params:Record<string,string>={client_id:provider==='google'?env.GOOGLE_CLIENT_ID!:env.GITHUB_CLIENT_ID!,redirect_uri:oauthCallback(provider),response_type:'code',state,code_challenge:await pkceChallenge(verifier),code_challenge_method:'S256',scope:provider==='google'?'openid email profile':'',prompt:'select_account'};
  if(provider==='google')params.nonce=nonce;
  for(const [key,value] of Object.entries(params))target.searchParams.set(key,value);
  const response=redirect(target.href,base());response.cookies.set(OAUTH_COOKIE,state,cookie);return response;
 }catch(e){return redirect('/codemate/login?error='+(e instanceof RequestError&&e.status===403?'reauthenticate':'authentication'),new URL(req.url).origin);}
}
export async function finishOAuth(req:Request,provider:string){
 const origin=new URL(req.url).origin,fail=(reason='authentication',target='/codemate')=>redirect('/codemate/login?error='+reason+'&returnTo='+encodeURIComponent(safeReturn(target)),origin);
 if(!oauthProvider(provider)||!oauthReady(provider))return fail('setup');
 const jar=await cookies(),state=jar.get(OAUTH_COOKIE)?.value,q=new URL(req.url).searchParams;
 let returnTo='/codemate';
 try{
 if(!state||state.length>200||q.get('state')!==state||origin!==base())return fail('state');
  await rateLimit('oauth-callback:'+String(req.headers.get('cf-connecting-ip')||'local'),30,600000);
  const flow=await env.DB!.prepare('DELETE FROM cr_oauth_flows WHERE token_hash=? AND provider=? AND expires_at>? RETURNING *').bind(await digest(state),provider,Date.now()).first<OAuthFlow>();
  jar.set(OAUTH_COOKIE,'',{...cookie,maxAge:0});
  if(!flow)throw new RequestError('Sign-in expired.');returnTo=safeReturn(flow.return_to);
  if(q.has('error'))return fail('cancelled',returnTo);
  const code=q.get('code');if(!code||code.length>4096)throw new RequestError('Invalid authorization code.');
  const response=await fetch(provider==='google'?'https://oauth2.googleapis.com/token':'https://github.com/login/oauth/access_token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Accept':'application/json'},body:new URLSearchParams({client_id:provider==='google'?env.GOOGLE_CLIENT_ID!:env.GITHUB_CLIENT_ID!,client_secret:provider==='google'?env.GOOGLE_CLIENT_SECRET!:env.GITHUB_CLIENT_SECRET!,code,code_verifier:flow.verifier,grant_type:'authorization_code',redirect_uri:oauthCallback(provider)}),signal:AbortSignal.timeout(15000),redirect:'error'});
  const tokens=await response.json() as {id_token?:string};if(!response.ok)throw new RequestError('Provider unavailable.');
  let identity;
  if(provider==='google'){if(typeof tokens.id_token!=='string'||tokens.id_token.length>16384)throw new RequestError('Invalid identity token.');identity=await verifyCritourGoogle(tokens.id_token,env.GOOGLE_CLIENT_ID!,flow.nonce);}
  else{const token=validGithubToken(tokens),profile=await fetch('https://api.github.com/user',{headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','User-Agent':'CritOur-Authentication','X-GitHub-Api-Version':'2022-11-28'},signal:AbortSignal.timeout(15000),redirect:'error'});if(!profile.ok)throw new RequestError('GitHub identity unavailable.');identity=githubIdentity(await profile.json());}
  // Provider access/refresh tokens are never persisted or returned to the browser.
  if(flow.link_account_id){
   if(!flow.link_session_hash||!await validLinkSession(env.DB!,flow.link_session_hash,flow.link_account_id))throw new RequestError('Linking session expired.',403);
   const pending=randomToken();await env.DB!.prepare('INSERT INTO cr_oauth_pending_links(token_hash,provider,subject,display_name,account_id,session_hash,expires_at)VALUES(?,?,?,?,?,?,?)').bind(await digest(pending),identity.provider,identity.subject,identity.displayName,flow.link_account_id,flow.link_session_hash,Date.now()+300000).run();
   const r=redirect('/codemate/profile?link=pending',base());r.cookies.set(LINK_COOKIE,pending,{...cookie,maxAge:300});return r;
  }
  const account=await oauthAccount(env.DB!,identity),old=jar.get(WORKSPACE_COOKIE)?.value,token=await oauthSession(env.DB!,account.id,flow.link_session_hash||(old?await digest(old):undefined));
  const r=redirect(safeReturn(flow.return_to),base());r.cookies.set(WORKSPACE_COOKIE,token,{httpOnly:true,secure:true,sameSite:'strict',path:'/',maxAge:43200});return r;
 }catch{return fail('authentication',returnTo);}
}
