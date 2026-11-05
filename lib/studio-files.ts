import {env} from 'cloudflare:workers';
import {getAdminUser} from '@/lib/admin-auth';
import {siteAdminUser} from '@/lib/site-access';
import {studioActor} from '@/lib/studio-access';
import {studioChannel} from '@/lib/studio-collaboration';
import {RequestError} from '@/lib/request-security';
export async function fileScope(kind:string,id:string,write=false){
 const user=await getAdminUser();if(!user)throw new RequestError('ログインしてください。',401);
 if(kind==='channel'){const actor=await studioActor(),channel=await studioChannel(actor,id,write);return {user,projectId:channel.project_id};}
 if(kind==='team'&&id==='team'&&await siteAdminUser())return {user,projectId:null};
 if(kind==='dm'&&await env.DB!.prepare('SELECT 1 FROM direct_conversation_participants WHERE conversation_id=? AND member_id=?').bind(id,user.accountId).first())return {user,projectId:null};
 throw new RequestError('ファイルが見つかりません。',404);
}
export async function fileAccess(id:string){
 const file=await env.DB!.prepare('SELECT * FROM studio_files WHERE id=?').bind(id).first<any>();if(!file)throw new RequestError('ファイルが見つかりません。',404);
 const {user}=await fileScope(file.scope_kind,file.scope_id);
 const binding=file.studio_message_id||file.direct_message_id||file.team_message_id;
 if(!binding){if(file.uploaded_by!==user.accountId||Date.parse(file.created_at)<Date.now()-86400000)throw new RequestError('ファイルが見つかりません。',404);}else{
 const table=file.studio_message_id?'studio_messages':file.direct_message_id?'direct_messages':'team_messages';
 if(!await env.DB!.prepare(`SELECT id FROM ${table} WHERE id=? AND deleted_at IS NULL`).bind(binding).first())throw new RequestError('ファイルが見つかりません。',404);
 }
 return {file,user};
}
