import {env} from 'cloudflare:workers';
import {normalizeGmail} from './google-identity';
export const GOOGLE_FLOW_COOKIE='__Host-motto-google-flow';
export function googleReady(){return !!env.GOOGLE_CLIENT_ID&&!!env.GOOGLE_CLIENT_SECRET&&!!env.AUTH_BASE_URL;}
export function authBase(){const base=new URL(env.AUTH_BASE_URL!);if(base.protocol!=='https:'||base.username||base.password)throw Error('Invalid OAuth origin');return base.origin;}
export function callbackUrl(){return authBase()+'/api/auth/google/callback';}
export async function bootstrapInitialAdmin(identity:{email:string;displayName:string}){
 if(identity.email!==normalizeGmail(env.INITIAL_ADMIN_EMAIL))return;
 const db=env.DB!;
 if(await db.prepare('SELECT email FROM allowed_emails LIMIT 1').first())return;
 const publicId='google-member-'+crypto.randomUUID(),at=new Date().toISOString();
 try{
 await db.batch([
 db.prepare('INSERT INTO workspace_bootstrap(id)VALUES(1)'),
 db.prepare('INSERT INTO members(id,name,role,visible,created_at,updated_at)VALUES(?,?,\'Team\',0,?,?)').bind(publicId,identity.displayName,at,at),
 db.prepare('INSERT INTO allowed_emails(email,public_member_id,created_at,updated_by)VALUES(?,?,?,\'verified-initial-google-login\')').bind(identity.email,publicId,at),
 ]);
 }catch{
 // Concurrent first logins may race; only the exact enrolled identity can proceed.
 if(!await db.prepare('SELECT email FROM allowed_emails WHERE email=? AND disabled_at IS NULL').bind(identity.email).first())throw Error('Initial enrollment failed');
 }
}
export async function googleAccount(identity:{email:string;userId:string;displayName:string}){
 const db=env.DB!,at=new Date().toISOString();
 const allowed=await db.prepare('SELECT public_member_id FROM allowed_emails WHERE email=? AND disabled_at IS NULL').bind(identity.email).first<{public_member_id:string}>();
 if(!allowed)throw Error('Access denied');
 const old=await db.prepare('SELECT email,auth_user_id FROM member_accounts WHERE public_member_id=?').bind(allowed.public_member_id).first<{email:string|null;auth_user_id:string}>();
 if(old&&(old.email!==identity.email||old.auth_user_id!==identity.userId))throw Error('Account identities cannot be transferred');
 if(!old){
 // The legacy non-null column is retained for schema compatibility; this marker is never a login credential.
 await db.prepare(`INSERT INTO member_accounts(id,public_member_id,auth_user_id,email,display_name,pin_hash,activated_at,created_at)
 SELECT ?,e.public_member_id,?,?,?,'!google-only',?,? FROM allowed_emails e WHERE e.email=? AND e.disabled_at IS NULL
 ON CONFLICT(public_member_id) DO NOTHING`).bind(crypto.randomUUID(),identity.userId,identity.email,identity.displayName,at,at,identity.email).run();
 }
 const account=await db.prepare(`SELECT a.id,a.display_name,a.session_version FROM member_accounts a JOIN allowed_emails e ON e.email=a.email AND e.public_member_id=a.public_member_id AND e.disabled_at IS NULL WHERE a.email=? AND a.auth_user_id=?`).bind(identity.email,identity.userId).first<{id:string;display_name:string;session_version:number}>();
 if(!account)throw Error('Access denied');return account;
}
