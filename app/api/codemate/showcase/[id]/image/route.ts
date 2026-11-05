import {env} from 'cloudflare:workers';
import {codemateActor} from '@/lib/codemate-access';
import {visibleListing} from '@/lib/codemate-showcase';
import {studioError} from '@/lib/studio-response';
import {RequestError} from '@/lib/request-security';
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){try{
 const s=await visibleListing(await codemateActor(),(await params).id);
 const a=await env.DB!.prepare('SELECT storage_key,mime FROM cm_assets WHERE id=? AND project_id=?').bind(s.after_asset_id,s.project_id).first<{storage_key:string;mime:string}>();
 const file=a&&await env.BUCKET?.get(a.storage_key);
 if(!a||!file||!['image/png','image/jpeg','image/webp'].includes(a.mime))throw new RequestError('画像が見つかりません。',404);
 return new Response(file.body,{headers:{'Content-Type':a.mime,'Cache-Control':'private, no-store','Content-Security-Policy':"default-src 'none'; sandbox",'X-Content-Type-Options':'nosniff'}});
}catch(e){return studioError(e)}}
