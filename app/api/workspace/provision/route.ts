import {env} from 'cloudflare:workers';
import {NextResponse} from 'next/server';
import {digest} from '@/lib/workspace-security';
import {rateLimit} from '@/lib/admin-auth';
import {readJson} from '@/lib/request-security';
export const dynamic='force-dynamic';
// Initial enrollment and operational recovery only. No invitation/legacy login path remains.
export async function POST(req:Request){
 if(!env.WORKSPACE_PROVISION_KEY||await digest(req.headers.get('authorization')||'')!==await digest('Bearer '+env.WORKSPACE_PROVISION_KEY))return NextResponse.json({error:'Forbidden'},{status:403});
 try{
 await rateLimit('provision',20);const b=await readJson(req,16384);
 if(b.action==='members')return NextResponse.json((await env.DB!.prepare('SELECT id,name FROM members ORDER BY display_order').all()).results,{headers:{'Cache-Control':'no-store'}});
 if(b.action!=='bootstrap')return NextResponse.json({error:'Invitation and activation code issuance has ended.'},{status:410});
 if(!Array.isArray(b.entries)||!b.entries.length||b.entries.length>30)throw Error('Provide approved email/member mappings');
 const statements=b.entries.map((entry:any)=>{
 const email=String(entry.email||'').trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)throw Error('Invalid email');
 return env.DB!.prepare(`INSERT INTO allowed_emails (email,public_member_id,created_at,updated_by)
 VALUES (?,?,?,'initial-setup')`).bind(email,String(entry.memberId),new Date().toISOString());});
 // Only a fresh installation. The DB guard prevents later operations-key enrollment bypasses.
 await env.DB!.batch([env.DB!.prepare("INSERT INTO workspace_bootstrap (id) VALUES (1)"),...statements]);
 return NextResponse.json({ok:true,count:statements.length});
 }catch{return NextResponse.json({error:'Bootstrap failed or has already been completed. Use Approved Emails in Settings.'},{status:400});}
}
