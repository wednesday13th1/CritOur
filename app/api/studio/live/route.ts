import {RequestError} from '@/lib/request-security';
import {env} from 'cloudflare:workers';
import {cookies} from 'next/headers';
import {studioActor,studioProject,activeStudioAccount} from '@/lib/studio-access';
import {studioError} from '@/lib/studio-response';
import {WORKSPACE_COOKIE,rateLimit} from '@/lib/admin-auth';
import {digest} from '@/lib/workspace-security';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{
 const actor=await studioActor(),id=new URL(req.url).searchParams.get('projectId')||'';await studioProject(actor,id);try{await rateLimit('studio-live:'+actor.accountId,60);}catch{throw new RequestError('操作が多すぎます。少し待ってお試しください。',429);}
 const tokenHash=await digest((await cookies()).get(WORKSPACE_COOKIE)?.value||''),encoder=new TextEncoder();let stop=()=>{};
 const stream=new ReadableStream<Uint8Array>({start(controller){let closed=false,running=false,last=-1;let timer:ReturnType<typeof setInterval>,expiry:ReturnType<typeof setTimeout>;
 const close=()=>{if(closed)return;closed=true;clearInterval(timer);clearTimeout(expiry);req.signal.removeEventListener('abort',close);try{controller.close()}catch{}};stop=close;
 const emit=(event:string,data:any)=>{if(!closed)controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))};
 const tick=async()=>{if(closed||running)return;running=true;try{
 const valid=await env.DB!.prepare(`SELECT a.id,EXISTS(SELECT 1 FROM studio_admins x WHERE x.id=1 AND x.account_id=a.id AND x.auth_user_id=a.auth_user_id) AS admin FROM member_accounts a JOIN workspace_sessions s ON s.auth_user_id=a.auth_user_id AND s.version=a.session_version LEFT JOIN allowed_emails e ON e.email=a.email AND e.public_member_id=a.public_member_id AND e.disabled_at IS NULL WHERE a.id=? AND a.auth_user_id=? AND s.token_hash=? AND s.purpose='admin' AND s.expires_at>? AND s.verified_at>0 AND ${activeStudioAccount}`).bind(actor.accountId,actor.userId,tokenHash,Date.now()).first<any>();
 if(!valid){emit('revoked',{});close();return;}const project=await studioProject({...actor,isStudioAdmin:!!valid.admin},id);if(project.revision!==last){last=project.revision;emit('refresh',{revision:last});}else emit('heartbeat',{});
 }catch(e){if(e instanceof RequestError&&[401,403,404].includes(e.status))emit('revoked',{});else emit('retrying',{});close()}finally{running=false}};
 controller.enqueue(encoder.encode('retry: 3000\n\n'));timer=setInterval(()=>void tick(),1000);expiry=setTimeout(close,55000);req.signal.addEventListener('abort',close,{once:true});void tick();},cancel(){stop()}});
 return new Response(stream,{headers:{'Content-Type':'text/event-stream','Cache-Control':'private, no-store','X-Accel-Buffering':'no'}});
 }catch(e){return studioError(e)}}
