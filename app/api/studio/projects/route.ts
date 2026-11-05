import {env} from 'cloudflare:workers';
import {studioActor,studioAdmin,studioProjectList,studioLog} from '@/lib/studio-access';
import {studioJson,studioError,studioSummary} from '@/lib/studio-response';
import {sameOrigin,rateLimit} from '@/lib/admin-auth';
import {readJson,RequestError} from '@/lib/request-security';
export const dynamic='force-dynamic';
export async function GET(){try{const user=await studioActor();return studioJson({projects:await studioProjectList(user),user:studioSummary(user)})}catch(e){return studioError(e)}}
export async function POST(req:Request){
 if(!sameOrigin(req))return studioJson({error:'Invalid origin'},403);
 try{const user=await studioActor();studioAdmin(user);await rateLimit('studio-create:'+user.accountId,30);
 const b=await readJson(req,8192),name=typeof b.name==='string'?b.name.trim():'',description=b.description??'',cms=b.cmsProjectId??null;
 if(!name||name.length>100||typeof description!=='string'||description.length>4000||cms!==null&&(typeof cms!=='string'||cms.length>100))throw new RequestError('名前は100文字以内、概要は4000文字以内にしてください。');
 if(cms&&!await env.DB!.prepare('SELECT id FROM projects WHERE id=?').bind(cms).first())throw new RequestError('公開サイト側のプロジェクトが見つかりません。');
 const id=crypto.randomUUID(),now=new Date().toISOString();
 await env.DB!.batch([env.DB!.prepare('INSERT INTO studio_projects(id,name,description,cms_project_id,created_by,created_at,updated_at)VALUES(?,?,?,?,?,?,?)').bind(id,name,description,cms,user.accountId,now,now),studioLog(id,user,'project.create'),...['general','frontend','backend','bugs','ideas'].map(name=>env.DB!.prepare('INSERT INTO studio_channels(id,project_id,name,created_by,created_at)VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),id,name,user.accountId,now))]);
 return studioJson({ok:true,id},201);
 }catch(e){return studioError(e)}
}
