import type {OAuthProvider} from '@/lib/critour-oauth-policy';
import {env} from 'cloudflare:workers';
import {cookies} from 'next/headers';
import {getAdminUser,sameOrigin,WORKSPACE_COOKIE,rateLimit,recentlyVerified} from '@/lib/admin-auth';
import {LINK_COOKIE,oauthReady,oauthEnabled} from '@/lib/critour-oauth';
import {linkOAuthIdentity,validLinkSession,oauthSession} from '@/lib/critour-oauth-accounts';
import {readJson,RequestError} from '@/lib/request-security';
import {digest} from '@/lib/workspace-security';
import {studioJson,studioError} from '@/lib/studio-response';
export const dynamic='force-dynamic';
export async function GET(){try{
 const user=await getAdminUser();if(!user)throw new RequestError('Sign in to manage connected accounts.',401);
 const ready={google:oauthReady('google'),github:oauthReady('github')};
 if(!oauthEnabled())return studioJson({identities:[],pending:null,ready,user:{displayName:user.displayName,bio:user.bio},enabled:false});
 const jar=await cookies(),token=jar.get(LINK_COOKIE)?.value;
 const rows=await env.DB!.prepare('SELECT provider,created_at FROM cr_oauth_identities WHERE account_id=? ORDER BY provider').bind(user.accountId).all();
 const pending=token?await env.DB!.prepare('SELECT provider,display_name FROM cr_oauth_pending_links WHERE token_hash=? AND account_id=? AND expires_at>?').bind(await digest(token),user.accountId,Date.now()).first():null;
 return studioJson({identities:rows.results,pending,ready,user:{displayName:user.displayName,bio:user.bio},enabled:true});
 }catch(e){return studioError(e)}}
export async function POST(req:Request){if(!sameOrigin(req))return studioJson({error:'Invalid origin'},403);try{
 const user=await getAdminUser();if(!user)throw new RequestError('Sign in first.',401);await rateLimit('oauth-link:'+user.accountId,10,600000);
 if(!oauthEnabled())throw new RequestError('Account linking is not configured yet.',503);
 const b=await readJson(req,1024),jar=await cookies(),token=jar.get(LINK_COOKIE)?.value,session=jar.get(WORKSPACE_COOKIE)?.value;
 if(!token||!session)throw new RequestError('This connection request expired.',410);
 if(b.action==='cancel'){await env.DB!.prepare('DELETE FROM cr_oauth_pending_links WHERE token_hash=? AND account_id=?').bind(await digest(token),user.accountId).run();jar.set(LINK_COOKIE,'',{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:0});return studioJson({ok:true});}
 if(b.action!=='confirm'||b.confirm!==true||!recentlyVerified(user))throw new RequestError('Sign in again and explicitly confirm the connection.',403);
 const hash=await digest(session),pending=await env.DB!.prepare('DELETE FROM cr_oauth_pending_links WHERE token_hash=? AND account_id=? AND session_hash=? AND expires_at>? RETURNING *').bind(await digest(token),user.accountId,hash,Date.now()).first<{provider:OAuthProvider;subject:string;display_name:string}>();
 if(!pending||!await validLinkSession(env.DB!,hash,user.accountId))throw new RequestError('This connection request expired.',410);
 await linkOAuthIdentity(env.DB!,{provider:pending.provider,subject:pending.subject,displayName:pending.display_name},user.accountId,hash);
 const next=await oauthSession(env.DB!,user.accountId,hash);jar.set(WORKSPACE_COOKIE,next,{httpOnly:true,secure:true,sameSite:'strict',path:'/',maxAge:43200});jar.set(LINK_COOKIE,'',{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:0});
 return studioJson({ok:true});
 }catch(e){return studioError(e)}}
