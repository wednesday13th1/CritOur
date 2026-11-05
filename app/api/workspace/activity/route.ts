import {siteAdminUser} from '@/lib/site-access';
import {readJson,RequestError} from '@/lib/request-security';
import {env} from 'cloudflare:workers';
import {NextResponse} from 'next/server';
import {sameOrigin,rateLimit} from '@/lib/admin-auth';
export const dynamic='force-dynamic';
export async function GET(req:Request){
 if(!await siteAdminUser())return NextResponse.json({error:'Unauthorized'},{status:401});
 const before=new URL(req.url).searchParams.get('before')||'9999';
 const logs=await env.DB!.prepare('SELECT * FROM audit_logs WHERE created_at < ? ORDER BY created_at DESC,id DESC LIMIT 100').bind(before).all();
 return NextResponse.json({logs:logs.results},{headers:{'Cache-Control':'no-store'}});
}

export async function DELETE(req:Request){if(!sameOrigin(req))return NextResponse.json({error:'Invalid origin'},{status:403});const u=await siteAdminUser();if(!u?.isOwner)return NextResponse.json({error:'Owner only'},{status:403});try{await rateLimit('updates-delete:'+u.accountId,30);const b:any=await readJson(req);await env.DB!.prepare('DELETE FROM activity WHERE id=?').bind(String(b.id)).run();const {audit}=await import('@/lib/audit');await audit('website-update.delete',String(b.id),u);return NextResponse.json({ok:true});}catch(e){return NextResponse.json({error:e instanceof RequestError?e.message:'Unable to delete update'},{status:e instanceof RequestError?e.status:400})}}
