import {env} from 'cloudflare:workers';
import {codemateActor,codemateProject} from '@/lib/codemate-access';
import {sameOrigin,rateLimit} from '@/lib/admin-auth';
import {readBody,RequestError} from '@/lib/request-security';
import {attachmentPolicy} from '@/lib/studio-file-policy';
import {studioJson,studioError} from '@/lib/studio-response';
export async function POST(req:Request){if(!sameOrigin(req))return studioJson({error:'Invalid origin'},403);try{
 const user=await codemateActor();await rateLimit('cm-image:'+user.accountId,20,600000);const bytes=await readBody(req,5*1024*1024+65536),form=await new Request(req.url,{method:'POST',headers:{'Content-Type':req.headers.get('content-type')||''},body:bytes as BodyInit}).formData(),projectId=String(form.get('projectId')||'');await codemateProject(user,projectId,true);
 const file=form.get('file');if(!(file instanceof File)||file.size>5*1024*1024)throw new RequestError('5MB以下のPNG・JPEG・WebP画像を選んでください。');const content=new Uint8Array(await file.arrayBuffer()),policy=attachmentPolicy(file.name,content);if(!['image/png','image/jpeg','image/webp'].includes(policy.mime))throw new RequestError('PNG・JPEG・WebPのみ保存できます。');if(!env.BUCKET)throw new RequestError('画像保存を利用できません。',503);
 const id=crypto.randomUUID(),key='codemate/'+id+'.'+policy.ext;await env.BUCKET.put(key,content,{httpMetadata:{contentType:policy.mime}});try{await env.DB!.prepare('INSERT INTO cm_assets(id,project_id,storage_key,mime,bytes,uploaded_by,created_at)VALUES(?,?,?,?,?,?,?)').bind(id,projectId,key,policy.mime,content.length,user.accountId,new Date().toISOString()).run()}catch(e){await env.BUCKET.delete(key);throw e}return studioJson({id},201);
 }catch(e){return studioError(e)}}
