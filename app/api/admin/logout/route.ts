import {OAUTH_COOKIE,LINK_COOKIE} from "@/lib/critour-oauth";
import {GOOGLE_FLOW_COOKIE} from "@/lib/google-auth";
import { env } from 'cloudflare:workers';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { sameOrigin,WORKSPACE_COOKIE,ACCESS_COOKIE,EMAIL_COOKIE } from '@/lib/admin-auth';
import { digest } from '@/lib/workspace-security';
export async function POST(request:Request) {
 if(!sameOrigin(request))return NextResponse.json({error:'Invalid origin'},{status:403});
 const jar=await cookies();
 const schema=await env.DB!.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='cr_oauth_flows'").first();
 if(schema){for(const name of [OAUTH_COOKIE,LINK_COOKIE]){const token=jar.get(name)?.value;if(token){const hash=await digest(token);await env.DB!.batch([env.DB!.prepare('DELETE FROM cr_oauth_flows WHERE token_hash=?').bind(hash),env.DB!.prepare('DELETE FROM cr_oauth_pending_links WHERE token_hash=?').bind(hash)]);}jar.set(name,'',{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:0});}}

 for(const name of [WORKSPACE_COOKIE,ACCESS_COOKIE,EMAIL_COOKIE,GOOGLE_FLOW_COOKIE]){const token=jar.get(name)?.value;if(token){await env.DB!.prepare('DELETE FROM workspace_sessions WHERE token_hash=?').bind(await digest(token)).run();await env.DB!.prepare('DELETE FROM email_challenges WHERE token_hash=?').bind(await digest(token)).run();await env.DB!.prepare('DELETE FROM google_login_flows WHERE token_hash=?').bind(await digest(token)).run();}jar.set(name,'',{httpOnly:true,secure:true,sameSite:'strict',path:'/',maxAge:0});}
 return NextResponse.redirect(new URL('/admin/login',request.url),303);
}
