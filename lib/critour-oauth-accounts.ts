import {digest} from './workspace-security';
import {RequestError} from './request-security';
import type {OAuthIdentity} from './critour-oauth-policy';
type Account={id:string;auth_user_id:string;session_version:number;display_name:string};
const active=`a.disabled_at IS NULL AND ((a.auth_user_id LIKE 'google:%' AND EXISTS(SELECT 1 FROM allowed_emails e WHERE e.email=a.email AND e.public_member_id=a.public_member_id AND e.disabled_at IS NULL)) OR (a.auth_user_id NOT LIKE 'google:%' AND a.login_code_hash IS NOT NULL))`;
export async function oauthAccount(db:D1Database,identity:OAuthIdentity){
 const existing=await db.prepare(`SELECT a.id,a.auth_user_id,a.session_version,a.display_name FROM cr_oauth_identities i JOIN member_accounts a ON a.id=i.account_id WHERE i.provider=? AND i.subject=? AND ${active}`).bind(identity.provider,identity.subject).first<Account>();
 if(existing)return existing;
 // Disabled identities may not create replacement accounts or bypass revocation.
 if(await db.prepare('SELECT 1 FROM cr_oauth_identities WHERE provider=? AND subject=?').bind(identity.provider,identity.subject).first())throw new RequestError('This account is unavailable.',403);
 // Migrate only an exact existing immutable Google subject. Never use matching emails.
 const legacy=identity.provider==='google'?await db.prepare(`SELECT a.id,a.auth_user_id,a.session_version,a.display_name FROM member_accounts a WHERE a.auth_user_id=? AND ${active}`).bind('google:'+identity.subject).first<Account>():null;
 if(identity.provider==='google'&&!legacy&&await db.prepare('SELECT 1 FROM member_accounts WHERE auth_user_id=?').bind('google:'+identity.subject).first())throw new RequestError('This account is unavailable.',403);
 if(legacy){await linkOAuthIdentity(db,identity,legacy.id);return legacy;}
 const hash=await digest(identity.provider+':'+identity.subject),accountId='cr-'+hash.slice(0,40),publicId='cr-member-'+hash.slice(0,40),at=new Date().toISOString();
 await db.batch([
  db.prepare("INSERT INTO members(id,name,role,visible,created_at,updated_at) SELECT ?,?,'Creator',0,?,? WHERE NOT EXISTS(SELECT 1 FROM cr_oauth_identities WHERE provider=? AND subject=?) ON CONFLICT(id) DO NOTHING").bind(publicId,identity.displayName,at,at,identity.provider,identity.subject),
  // Non-credential markers satisfy legacy schema constraints; they can never match a SHA-256 login code.
  db.prepare("INSERT INTO member_accounts(id,public_member_id,auth_user_id,display_name,pin_hash,login_code_hash,activated_at,created_at) SELECT ?,?,?,?,'!oauth-only','!oauth-only',?,? WHERE NOT EXISTS(SELECT 1 FROM cr_oauth_identities WHERE provider=? AND subject=?) ON CONFLICT(id) DO NOTHING").bind(accountId,publicId,'critour:'+accountId,identity.displayName,at,at,identity.provider,identity.subject),
  db.prepare('INSERT INTO cr_oauth_identities(provider,subject,account_id,created_at) SELECT ?,?,a.id,? FROM member_accounts a WHERE a.id=? ON CONFLICT(provider,subject) DO NOTHING').bind(identity.provider,identity.subject,at,accountId)
 ]);
 const result=await db.prepare(`SELECT a.id,a.auth_user_id,a.session_version,a.display_name FROM cr_oauth_identities i JOIN member_accounts a ON a.id=i.account_id WHERE i.provider=? AND i.subject=? AND ${active}`).bind(identity.provider,identity.subject).first<Account>();
 if(!result)throw new RequestError('Could not create this account.',409);return result;
}
export async function linkOAuthIdentity(db:D1Database,identity:OAuthIdentity,accountId:string,sessionHash?:string){
 const old=await db.prepare('SELECT account_id FROM cr_oauth_identities WHERE provider=? AND subject=?').bind(identity.provider,identity.subject).first<{account_id:string}>();
 if(old&&old.account_id!==accountId)throw new RequestError('That provider account is already connected to another CritOur account. Accounts were not merged.',409);
 const other=await db.prepare('SELECT subject FROM cr_oauth_identities WHERE provider=? AND account_id=?').bind(identity.provider,accountId).first<{subject:string}>();
 if(other&&other.subject!==identity.subject)throw new RequestError('A different account from this provider is already connected.',409);
 await db.prepare(`INSERT INTO cr_oauth_identities(provider,subject,account_id,created_at) SELECT ?,?,a.id,? FROM member_accounts a WHERE a.id=? AND ${active} ${sessionHash?"AND EXISTS(SELECT 1 FROM workspace_sessions s WHERE s.auth_user_id=a.auth_user_id AND s.version=a.session_version AND s.token_hash=? AND s.purpose='admin' AND s.expires_at>? AND s.verified_at>? AND s.verified_at<=?)":''} ON CONFLICT(provider,subject) DO NOTHING`).bind(identity.provider,identity.subject,new Date().toISOString(),accountId,...(sessionHash?[sessionHash,Date.now(),Date.now()-300000,Date.now()]:[])).run();
 const saved=await db.prepare('SELECT account_id FROM cr_oauth_identities WHERE provider=? AND subject=?').bind(identity.provider,identity.subject).first<{account_id:string}>();if(saved?.account_id!==accountId)throw new RequestError('Could not connect this account. No existing identity was changed.',409);
}
export async function validLinkSession(db:D1Database,hash:string,accountId:string){return db.prepare(`SELECT a.id FROM member_accounts a JOIN workspace_sessions s ON s.auth_user_id=a.auth_user_id AND s.version=a.session_version WHERE s.token_hash=? AND s.purpose='admin' AND s.expires_at>? AND s.verified_at>? AND s.verified_at<=? AND a.id=? AND ${active}`).bind(hash,Date.now(),Date.now()-300000,Date.now(),accountId).first();}
export async function oauthSession(db:D1Database,accountId:string,oldHash?:string){
 const token=crypto.randomUUID()+crypto.randomUUID(),at=Date.now(),tokenHash=await digest(token);
 const writes=[db.prepare(`INSERT INTO workspace_sessions(token_hash,auth_user_id,purpose,version,verified_at,expires_at) SELECT ?,a.auth_user_id,'admin',a.session_version,?,? FROM member_accounts a WHERE a.id=? AND ${active}`).bind(tokenHash,at,at+43200000,accountId)];
 if(oldHash)writes.push(db.prepare('DELETE FROM workspace_sessions WHERE token_hash=? AND token_hash!=?').bind(oldHash,tokenHash));
 const result=await db.batch(writes);if(!result[0].meta.changes)throw new RequestError('This account is unavailable.',403);return token;
}
