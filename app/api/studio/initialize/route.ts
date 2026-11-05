import {env} from 'cloudflare:workers';
import {studioActor} from '@/lib/studio-access';
import {studioJson,studioError} from '@/lib/studio-response';
import {sameOrigin,recentlyVerified,rateLimit} from '@/lib/admin-auth';
import {RequestError} from '@/lib/request-security';
export async function POST(req:Request){
 if(!sameOrigin(req))return studioJson({error:'Invalid origin'},403);
 try{const user=await studioActor();if(user.isStudioAdmin)return studioJson({ok:true});
 if(!user.canInitialize)throw new RequestError('現在のオーナーだけが初期設定できます。',403);
 if(!recentlyVerified(user))throw new RequestError('再ログインしてから5分以内に初期設定してください。',403);
 await rateLimit('studio-initialize:'+user.accountId,5);
 const now=new Date().toISOString();
 const result=await env.DB!.batch([
 env.DB!.prepare(`INSERT INTO studio_admins(id,account_id,auth_user_id,created_at) SELECT 1,a.id,a.auth_user_id,? FROM member_accounts a JOIN workspace_owners o ON o.public_member_id=a.public_member_id WHERE a.id=? AND a.auth_user_id=? AND a.disabled_at IS NULL AND NOT EXISTS(SELECT 1 FROM studio_admins)`).bind(now,user.accountId,user.userId),
 env.DB!.prepare(`INSERT INTO studio_activity(id,project_id,actor_id,action,created_at) SELECT ?,NULL,account_id,'workspace.initialize',? FROM studio_admins WHERE id=1 AND account_id=? AND auth_user_id=? AND created_at=?`).bind(crypto.randomUUID(),now,user.accountId,user.userId,now)]);
 if(!result[0].meta.changes)throw new RequestError('初期設定の状態が変わりました。再読み込みしてください。',409);
 return studioJson({ok:true});
 }catch(e){return studioError(e)}
}
