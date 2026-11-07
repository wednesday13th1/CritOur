import {RequestError} from './request-security';
import {env} from 'cloudflare:workers';
import {cookies} from 'next/headers';
import {digest} from './workspace-security';
export {recentlyVerified} from './session-policy';
export const WORKSPACE_COOKIE='__Host-motto-workspace';
export const ACCESS_COOKIE='__Host-motto-access'; // Clear legacy cookies on logout; never authorize them.
export const EMAIL_COOKIE='__Host-motto-email';
export async function getAdminUser() {
 const token=(await cookies()).get(WORKSPACE_COOKIE)?.value;
 if(!token||!env.DB)return null;
 const a=await env.DB.prepare(`SELECT a.id,a.public_member_id,a.display_name,a.avatar_url,a.bio,a.auth_user_id,a.email,s.verified_at,EXISTS(SELECT 1 FROM workspace_owners o WHERE o.public_member_id=a.public_member_id) AS is_owner
 FROM member_accounts a JOIN workspace_sessions s ON s.auth_user_id=a.auth_user_id AND s.version=a.session_version
 LEFT JOIN allowed_emails e ON e.email=a.email AND e.public_member_id=a.public_member_id AND e.disabled_at IS NULL
 WHERE s.token_hash=? AND s.purpose='admin' AND s.expires_at>? AND s.verified_at>0 AND a.disabled_at IS NULL AND ((a.auth_user_id LIKE 'google:%' AND e.email IS NOT NULL) OR (a.auth_user_id NOT LIKE 'google:%' AND a.login_code_hash IS NOT NULL))`).bind(await digest(token),Date.now()).first<{id:string;public_member_id:string;display_name:string;avatar_url:string|null;bio:string;auth_user_id:string;email:string;verified_at:number;is_owner:number}>();
 return a?{userId:a.auth_user_id,accountId:a.id,publicMemberId:a.public_member_id,displayName:a.display_name,avatarUrl:a.avatar_url,bio:a.bio,email:a.email,fullName:null,verifiedAt:a.verified_at,isOwner:!!a.is_owner}:null;
}
export async function issueSession(userId:string,version:number,verifiedAt:number) {
 const token=crypto.randomUUID()+crypto.randomUUID(),seconds=3600*12;
 const result=await env.DB!.prepare(`INSERT INTO workspace_sessions(token_hash,auth_user_id,purpose,version,verified_at,expires_at) SELECT ?,a.auth_user_id,'admin',a.session_version,?,? FROM member_accounts a LEFT JOIN allowed_emails e ON e.email=a.email AND e.public_member_id=a.public_member_id AND e.disabled_at IS NULL WHERE a.auth_user_id=? AND a.session_version=? AND a.disabled_at IS NULL AND e.email IS NOT NULL`).bind(await digest(token),verifiedAt,Date.now()+seconds*1000,userId,version).run();
 if(!result.meta.changes)throw Error('Access revoked');
 (await cookies()).set(WORKSPACE_COOKIE,token,{httpOnly:true,secure:true,sameSite:'strict',path:'/',maxAge:seconds});
}
export function sameOrigin(request:Request){return request.headers.get('origin')===new URL(request.url).origin;}
export async function rateLimit(key:string,limit:number,windowMs=600000) {
 const id='workspace:'+await digest(key),window=Math.floor(Date.now()/windowMs);
 const row=await env.DB!.prepare('INSERT INTO admin_login_attempts (id,window,attempts) VALUES (?,?,1) ON CONFLICT(id) DO UPDATE SET attempts=CASE WHEN window=excluded.window THEN attempts+1 ELSE 1 END,window=excluded.window RETURNING attempts').bind(id,window).first<{attempts:number}>();
 if(!row||row.attempts>limit)throw new RequestError('Too many requests. Please try again shortly.',429);
}
