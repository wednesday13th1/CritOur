import {siteAdminUser} from '@/lib/site-access';
import {env} from 'cloudflare:workers';
export async function GET(_:Request,{params}:{params:Promise<{key:string[]}>}){const{key}=await params;const path=key.join('/');if(!/^(?:uploads|private-uploads)\/[a-zA-Z0-9.-]+$/.test(path))return new Response('Not found',{status:404});
 const protectedFile=await env.DB!.prepare('SELECT 1 FROM protected_media WHERE path=?').bind('/media/'+path).first();
 const referenced=await env.DB!.prepare("SELECT id FROM projects WHERE admin_only=1 AND (cover_image=? OR app_icon=? OR gallery LIKE ?) LIMIT 1").bind('/media/'+path,'/media/'+path,'%'+path+'%').first();
 if((path.startsWith('private-uploads/')||protectedFile||referenced)&&!await siteAdminUser())return new Response('Not found',{status:404});
 const object=await env.BUCKET?.get(path);if(!object)return new Response('Not found',{status:404});return new Response(object.body,{headers:{'content-type':object.httpMetadata?.contentType||'application/octet-stream','cache-control':'private, no-store'}});}
