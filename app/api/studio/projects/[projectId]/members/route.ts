import {env} from 'cloudflare:workers';
import {studioActor,studioAdmin,studioProject,activeStudioAccount,studioLog} from '@/lib/studio-access';
import {studioJson,studioError} from '@/lib/studio-response';
import {sameOrigin,rateLimit,recentlyVerified} from '@/lib/admin-auth';
import {readJson,RequestError} from '@/lib/request-security';
export async function POST(req:Request,{params}:{params:Promise<{projectId:string}>}){
 if(!sameOrigin(req))return studioJson({error:'Invalid origin'},403);
 try{const user=await studioActor();studioAdmin(user);if(!recentlyVerified(user))throw new RequestError('メンバー変更は再ログインから5分以内に行ってください。',403);
 const id=(await params).projectId,project=await studioProject(user,id);if(project.archived_at)throw new RequestError('アーカイブを解除してからメンバーを変更してください。',409);
 await rateLimit('studio-members:'+user.accountId,60);const b=await readJson(req,2048),account=b.accountId;
 if(typeof account!=='string'||!account||account.length>100||!['add','remove'].includes(b.action))throw new RequestError('対象メンバーと操作を確認してください。');
 if(b.action==='add'){
 const valid=await env.DB!.prepare(`SELECT a.id FROM member_accounts a LEFT JOIN allowed_emails e ON e.email=a.email AND e.public_member_id=a.public_member_id AND e.disabled_at IS NULL WHERE a.id=? AND ${activeStudioAccount}`).bind(account).first();
 if(!valid)throw new RequestError('有効なログインアカウントを選んでください。');
 await env.DB!.batch([env.DB!.prepare(`INSERT INTO studio_project_members(project_id,account_id,added_by,joined_at) SELECT ?,a.id,?,? FROM member_accounts a LEFT JOIN allowed_emails e ON e.email=a.email AND e.public_member_id=a.public_member_id AND e.disabled_at IS NULL WHERE a.id=? AND ${activeStudioAccount} ON CONFLICT(project_id,account_id) DO NOTHING`).bind(id,user.accountId,new Date().toISOString(),account),studioLog(id,user,'member.add',account),env.DB!.prepare('UPDATE studio_projects SET revision=revision+1 WHERE id=?').bind(id)]);
 }else await env.DB!.batch([env.DB!.prepare('DELETE FROM studio_project_members WHERE project_id=? AND account_id=?').bind(id,account),studioLog(id,user,'member.remove',account),env.DB!.prepare('UPDATE studio_projects SET revision=revision+1 WHERE id=?').bind(id)]);
 return studioJson({ok:true});
 }catch(e){return studioError(e)}
}
