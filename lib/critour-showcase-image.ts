import {env} from 'cloudflare:workers';
import {RequestError} from './request-security';

export async function showcaseImage(project: string, allowed: (string | null)[], requested: string | null) {
  const id = requested ?? allowed[0];
  if (!id || !allowed.includes(id)) throw new RequestError("画像が見つかりません。", 404);
  const asset = await env.DB!.prepare('SELECT storage_key,mime FROM cm_assets WHERE id=? AND project_id=?').bind(id,project).first<{storage_key:string;mime:string}>();
  if (!asset || !['image/png','image/jpeg','image/webp'].includes(asset.mime)) throw new RequestError("画像が見つかりません。", 404);
  const object = await env.BUCKET?.get(asset.storage_key);
  if (!object) throw new RequestError("画像が見つかりません。", 404);
  return new Response(object.body,{headers:{'Content-Type':asset.mime,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
}
