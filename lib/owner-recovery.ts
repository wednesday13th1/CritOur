import {digest} from './workspace-security';
export type OwnerRecovery={memberId:string;expectedCodeHash:string;authorizationHash:string;expiresAt:number};
// The deployment operator must explicitly arm one exact account/version for 15 minutes.
// The compare-and-swap below consumes the authorization when the code changes.
export function recoveryConfig(raw:unknown,now=Date.now()):OwnerRecovery|null {
 if(typeof raw!=='string')return null;
 try{const c=JSON.parse(raw);if(typeof c.memberId!=='string'||!c.memberId||c.memberId.length>100||typeof c.expectedCodeHash!=='string'||! /^[a-f0-9]{64}$/.test(c.expectedCodeHash)||typeof c.authorizationHash!=='string'||! /^[a-f0-9]{64}$/.test(c.authorizationHash)||!Number.isSafeInteger(c.expiresAt)||c.expiresAt<=now||c.expiresAt>now+900000)return null;return {memberId:c.memberId,expectedCodeHash:c.expectedCodeHash,authorizationHash:c.authorizationHash,expiresAt:c.expiresAt}}catch{return null}
}
export async function rotateRecoveredOwner(db:D1Database,c:OwnerRecovery){
 const token=crypto.randomUUID()+crypto.randomUUID(),hash=await digest(token),at=new Date().toISOString();
 const results=await db.batch([
 db.prepare(`UPDATE member_accounts SET login_code_hash=?,session_version=session_version+1 WHERE public_member_id=? AND login_code_hash=? AND disabled_at IS NULL AND auth_user_id NOT LIKE 'google:%' AND EXISTS(SELECT 1 FROM workspace_owners o WHERE o.public_member_id=member_accounts.public_member_id)`).bind(hash,c.memberId,c.expectedCodeHash),
 db.prepare('DELETE FROM workspace_sessions WHERE auth_user_id IN(SELECT auth_user_id FROM member_accounts WHERE public_member_id=? AND login_code_hash=?)').bind(c.memberId,hash),
 db.prepare(`INSERT INTO audit_logs(id,actor_id,actor_name,action,resource,created_at) SELECT ?,NULL,'site-owner recovery','owner.code.recover',?,? WHERE EXISTS(SELECT 1 FROM member_accounts WHERE public_member_id=? AND login_code_hash=?)`).bind(crypto.randomUUID(),c.memberId,at,c.memberId,hash)
 ]);
 return results[0].meta.changes?token:null;
}
