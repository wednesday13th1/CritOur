import {env} from 'cloudflare:workers';
import {studioActor,studioAdmin,studioProject,studioProjectDetails,studioLog} from '@/lib/studio-access';
import {studioJson,studioError,studioSummary} from '@/lib/studio-response';
import {sameOrigin,rateLimit} from '@/lib/admin-auth';
import {readJson,RequestError} from '@/lib/request-security';
export const dynamic='force-dynamic';type Context={params:Promise<{projectId:string}>};
export async function GET(_:Request,{params}:Context){try{const user=await studioActor();return studioJson({...await studioProjectDetails(user,(await params).projectId),user:studioSummary(user)})}catch(e){return studioError(e)}}
export async function PATCH(req:Request,{params}:Context){
 if(!sameOrigin(req))return studioJson({error:'Invalid origin'},403);
 try{const user=await studioActor();studioAdmin(user);const id=(await params).projectId,current=await studioProject(user,id);await rateLimit('studio-edit:'+user.accountId,60);
 const b=await readJson(req,8192),name=b.name===undefined?current.name:typeof b.name==='string'?b.name.trim():'',description=b.description??current.description;
 if(!name||name.length>100||typeof description!=='string'||description.length>4000||b.archived!==undefined&&typeof b.archived!=='boolean')throw new RequestError('入力内容を確認してください。');
 const now=new Date().toISOString(),archived=b.archived===undefined?current.archived_at:b.archived?current.archived_at||now:null;
 await env.DB!.batch([env.DB!.prepare('UPDATE studio_projects SET revision=revision+1,name=?,description=?,archived_at=?,updated_at=? WHERE id=?').bind(name,description,archived,now,id),studioLog(id,user,b.archived===undefined?'project.update':b.archived?'project.archive':'project.restore')]);return studioJson({ok:true});
 }catch(e){return studioError(e)}
}
