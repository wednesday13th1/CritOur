import {env} from 'cloudflare:workers';
import {sameOrigin} from '@/lib/admin-auth';
import {RequestError} from '@/lib/request-security';
import {fileAccess} from '@/lib/studio-files';
import {studioJson,studioError} from '@/lib/studio-response';
export const dynamic='force-dynamic';type Context={params:Promise<{fileId:string}>};
export async function GET(_:Request,{params}:Context){try{
 const {file}=await fileAccess((await params).fileId),object=await env.BUCKET?.get(file.storage_key);if(!object)throw new RequestError('ファイルが見つかりません。',404);
 return new Response(object.body,{headers:{'Content-Type':file.mime,'Content-Length':String(file.bytes),'Content-Disposition':`attachment; filename="attachment.${file.filename.split('.').at(-1)}"; filename*=UTF-8''${encodeURIComponent(file.filename).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16))}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
 }catch(e){return studioError(e)}}
export async function DELETE(req:Request,{params}:Context){if(!sameOrigin(req))return studioJson({error:'Invalid origin'},403);try{
 const {file,user}=await fileAccess((await params).fileId);if(file.uploaded_by!==user.accountId||file.studio_message_id||file.direct_message_id||file.team_message_id)throw new RequestError('送信前の自分の添付だけ取り消せます。',403);
 const result=await env.DB!.prepare('DELETE FROM studio_files WHERE id=? AND studio_message_id IS NULL AND direct_message_id IS NULL AND team_message_id IS NULL').bind(file.id).run();if(!result.meta.changes)throw new RequestError('送信済みです。',409);await env.BUCKET?.delete(file.storage_key);return studioJson({ok:true});
 }catch(e){return studioError(e)}}
