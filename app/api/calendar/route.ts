import {siteAdminUser} from '@/lib/site-access';
import {env} from 'cloudflare:workers';
import {NextResponse} from 'next/server';
import {sameOrigin,rateLimit} from '@/lib/admin-auth';
import {readJson,RequestError,noStore} from '@/lib/request-security';
import {validEventDate} from '@/lib/calendar-utils';
import {audit} from '@/lib/audit';
export const dynamic='force-dynamic';
const json=(b:unknown,status=200)=>NextResponse.json(b,{status,headers:noStore});
export async function GET(req:Request){
 const admin=new URL(req.url).searchParams.get('admin')==='1';
 const user=admin?await siteAdminUser():null;
 if(admin&&!user)return json({error:'Unauthorized'},401);
 const rows=await env.DB!.prepare(`SELECT id,title,event_date,description,is_public,kind,completed,updated_at FROM calendar_events ${user?'':'WHERE is_public=1'} ORDER BY event_date,id`).all();
 return json({events:rows.results});
}
export async function POST(req:Request){
 if(!sameOrigin(req))return json({error:'Invalid origin'},403);
 const user=await siteAdminUser();if(!user)return json({error:'Unauthorized'},401);
 try{
  await rateLimit('calendar:'+user.accountId,60);
  const b=await readJson(req,16384),action=b.action??'create',db=env.DB!,now=new Date().toISOString();
  if(!['create','update','delete','complete'].includes(action))throw new RequestError('Unknown action');
  const id=typeof b.id==='string'?b.id:'';
  if(action!=='create'&&(!id||id.length>80))throw new RequestError('Invalid event');
  if(action==='delete'||action==='complete'){
   if(action==='complete'&&typeof b.completed!=='boolean')throw new RequestError('Invalid completion state');
   const result=action==='delete'?await db.prepare('DELETE FROM calendar_events WHERE id=?').bind(id).run():await db.prepare('UPDATE calendar_events SET completed=?,updated_at=? WHERE id=? AND kind=?').bind(b.completed?1:0,now,id,'deadline').run();
   if(!result.meta.changes)return json({error:'Event not found'},404);
   await audit('calendar.'+action,id,user);return json({ok:true});
  }
  const title=typeof b.title==='string'?b.title.trim():'',date=b.event_date,description=b.description??'',kind=b.kind??'event';
  if(!title||title.length>160||typeof description!=='string'||description.length>2000||!validEventDate(date)||!['event','deadline'].includes(kind)||typeof (b.is_public??false)!=='boolean')throw new RequestError('タイトル・日付・イベント種別を確認してください。');
  const eventId=action==='create'?crypto.randomUUID():id;
  const result=action==='create'?await db.prepare('INSERT INTO calendar_events(id,title,event_date,description,is_public,kind,completed,created_by,created_at,updated_at)VALUES(?,?,?,?,?,?,0,?,?,?)').bind(eventId,title,date,description,b.is_public===true?1:0,kind,user.accountId,now,now).run():await db.prepare('UPDATE calendar_events SET title=?,event_date=?,description=?,is_public=?,kind=?,completed=CASE WHEN kind=? THEN completed ELSE 0 END,updated_at=? WHERE id=?').bind(title,date,description,b.is_public===true?1:0,kind,kind,now,id).run();
  if(!result.meta.changes)return json({error:'Event not found'},404);
  await audit('calendar.'+action,eventId,user);return json({ok:true,id:eventId});
 }catch(e){return json({error:e instanceof RequestError?e.message:'保存できませんでした。連続操作の場合は少し待ってお試しください。'},e instanceof RequestError?e.status:400)}
}
