import {env} from 'cloudflare:workers';
import {getAdminUser,sameOrigin,rateLimit} from '@/lib/admin-auth';
import {readBody,RequestError} from '@/lib/request-security';
import {studioJson,studioError} from '@/lib/studio-response';
import {fileScope} from '@/lib/studio-files';
import {attachmentPolicy,attachmentLimit} from '@/lib/studio-file-policy';
export async function POST(req:Request){if(!sameOrigin(req))return studioJson({error:'Invalid origin'},403);try{
 const user=await getAdminUser();if(!user)throw new RequestError('ログインしてください。',401);try{await rateLimit('attachment-upload:'+user.accountId,30);}catch{throw new RequestError('操作が多すぎます。少し待ってお試しください。',429);}
 const bytes=await readBody(req,attachmentLimit+65536),form=await new Request(req.url,{method:'POST',headers:{'Content-Type':req.headers.get('content-type')||''},body:bytes as BodyInit}).formData();
 const kind=String(form.get('scopeKind')||''),scope=String(form.get('scopeId')||'');if(scope.length>100)throw new RequestError('送信先を確認してください。');const access=await fileScope(kind,scope,true),file=form.get('file');if(!(file instanceof File))throw new RequestError('ファイルを選択してください。');
 let policy;const content=new Uint8Array(await file.arrayBuffer());try{policy=attachmentPolicy(file.name,content)}catch(e){throw new RequestError(e instanceof Error?e.message:'Invalid file')}
 if(!env.BUCKET)throw new RequestError('ストレージが利用できません。',503);
 const expired=await env.DB!.prepare('SELECT id,storage_key FROM studio_files WHERE uploaded_by=? AND created_at<? AND studio_message_id IS NULL AND direct_message_id IS NULL AND team_message_id IS NULL LIMIT 10').bind(user.accountId,new Date(Date.now()-86400000).toISOString()).all<any>();for(const old of expired.results){const gone=await env.DB!.prepare('DELETE FROM studio_files WHERE id=? AND studio_message_id IS NULL AND direct_message_id IS NULL AND team_message_id IS NULL').bind(old.id).run();if(gone.meta.changes)await env.BUCKET.delete(old.storage_key)}
 const id=crypto.randomUUID(),key='workspace-files/'+id+'.'+policy.ext;
 await env.BUCKET.put(key,content,{httpMetadata:{contentType:policy.mime}});
 try{await env.DB!.prepare('INSERT INTO studio_files(id,storage_key,scope_kind,scope_id,project_id,uploaded_by,filename,mime,bytes,created_at)VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id,key,kind,scope,access.projectId,user.accountId,policy.filename,policy.mime,content.byteLength,new Date().toISOString()).run()}catch(e){await env.BUCKET.delete(key);throw e}
 return studioJson({id,filename:policy.filename,mime:policy.mime,bytes:content.byteLength},201);
 }catch(e){return studioError(e)}}
