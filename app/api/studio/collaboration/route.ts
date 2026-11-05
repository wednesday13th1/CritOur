import {env} from 'cloudflare:workers';
import {studioActor,studioProject,studioAdmin,studioLog} from '@/lib/studio-access';
import {studioJson,studioError} from '@/lib/studio-response';
import {studioConversation,studioMessageAction,studioTaskAction,studioChannel,touchStudio,studioCollaborators} from '@/lib/studio-collaboration';
import {sameOrigin,rateLimit} from '@/lib/admin-auth';
import {readJson,RequestError} from '@/lib/request-security';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{
 const user=await studioActor(),q=new URL(req.url).searchParams,view=q.get('view')||'channels',projectId=q.get('projectId')||'';await studioProject(user,projectId);const db=env.DB!;
 if(view==='messages'){const channel=await studioChannel(user,q.get('channelId')||'');if(channel.project_id!==projectId)throw new RequestError('チャンネルが見つかりません。',404);const before=Number(q.get('before')||0);if(!Number.isSafeInteger(before)||before<0)throw new RequestError('ページ指定を確認してください。');let ids:string[]|null=null;if(q.has('ids')){try{ids=JSON.parse(q.get('ids')!)}catch{throw new RequestError('メッセージ指定を確認してください。')}if(!Array.isArray(ids)||!ids.length||ids.length>50||ids.some(id=>typeof id!=='string'||!id||id.length>100))throw new RequestError('メッセージ指定を確認してください。');}return studioJson(await studioConversation(user,channel.id,before,q.get('parentId'),ids));}
 if(view==='message'){const message=await db.prepare('SELECT m.*,a.display_name,a.avatar_url FROM studio_messages m JOIN member_accounts a ON a.id=m.sender_id WHERE m.id=? AND m.project_id=? AND m.channel_id=?').bind(q.get('messageId')||'',projectId,q.get('channelId')||'').first<any>();if(!message)throw new RequestError('メッセージが見つかりません。',404);const files=message.deleted_at?[]:(await db.prepare('SELECT id,studio_message_id AS message_id,filename,mime,bytes FROM studio_files WHERE studio_message_id=?').bind(message.id).all()).results;const reactions=(await db.prepare('SELECT message_id,account_id,emoji FROM studio_reactions WHERE message_id=?').bind(message.id).all()).results;return studioJson({message,files,reactions});}
 if(view==='tasks'){const tasks=(await db.prepare('SELECT * FROM studio_tasks WHERE project_id=? ORDER BY updated_at DESC,id LIMIT 500').bind(projectId).all<any>()).results.map(t=>({...t,assigneeIds:JSON.parse(t.assignee_ids)}));return studioJson({tasks,people:await studioCollaborators(projectId)});}
 if(view==='task'){const task=await db.prepare('SELECT * FROM studio_tasks WHERE id=? AND project_id=?').bind(q.get('taskId')||'',projectId).first<any>();if(!task)throw new RequestError('タスクが見つかりません。',404);const comments=await db.prepare('SELECT c.id,c.content,c.created_at,a.display_name FROM studio_task_comments c JOIN member_accounts a ON a.id=c.account_id WHERE c.task_id=? AND c.project_id=? ORDER BY c.created_at,c.id LIMIT 200').bind(task.id,projectId).all();const source=task.source_message_id?await db.prepare('SELECT channel_id FROM studio_messages WHERE id=? AND project_id=?').bind(task.source_message_id,projectId).first<any>():null;return studioJson({task:{...task,source_channel_id:source?.channel_id,assigneeIds:JSON.parse(task.assignee_ids)},comments:comments.results});}
 if(view==='notifications'){const n=await db.prepare(`SELECT n.* FROM studio_notifications n WHERE n.project_id=? AND n.recipient_id=? AND n.available_at<=? AND (n.kind!='deadline' OR EXISTS(SELECT 1 FROM studio_tasks t,json_each(t.assignee_ids) a WHERE t.id=n.target_id AND t.status!='done' AND a.value=?)) ORDER BY n.created_at DESC,n.id DESC LIMIT 100`).bind(projectId,user.accountId,new Date().toISOString(),user.accountId).all();return studioJson({notifications:n.results});}
 if(view!=='channels')throw new RequestError('表示を確認してください。');
 const channels=await db.prepare(`SELECT c.*,(SELECT count(*) FROM studio_messages m WHERE m.channel_id=c.id AND m.sender_id!=? AND m.deleted_at IS NULL AND m.seq>COALESCE((SELECT last_seq FROM studio_reads r WHERE r.channel_id=c.id AND r.account_id=?),0)) AS unread FROM studio_channels c WHERE c.project_id=? ORDER BY c.archived_at IS NOT NULL,c.name!='general',c.created_at,c.id`).bind(user.accountId,user.accountId,projectId).all();return studioJson({channels:channels.results});
 }catch(e){return studioError(e)}}
export async function POST(req:Request){if(!sameOrigin(req))return studioJson({error:'Invalid origin'},403);try{
 const user=await studioActor();try{await rateLimit('studio-action:'+user.accountId,120,60000);}catch{throw new RequestError('操作が多すぎます。少し待ってお試しください。',429);}const b=await readJson(req,20000);
 if(typeof b.action!=='string')throw new RequestError('操作を確認してください。');
 if(b.action.startsWith('message.')&&b.action!=='message.read')return studioJson(await studioMessageAction(user,b));
 if(b.action.startsWith('task.'))return studioJson(await studioTaskAction(user,b));
 const project=await studioProject(user,String(b.projectId||'')),db=env.DB!,now=new Date().toISOString();if(project.archived_at)throw new RequestError('アーカイブ済みです。',409);
 if(b.action==='message.read'){
 const channel=await studioChannel(user,String(b.channelId||''));if(channel.project_id!==project.id)throw new RequestError('Not found',404);
 const row=await db.prepare('SELECT max(seq) AS max FROM studio_messages WHERE channel_id=?').bind(channel.id).first<any>();if(!Number.isSafeInteger(b.lastSeq)||b.lastSeq<0||b.lastSeq>(row?.max||0))throw new RequestError('既読位置を確認してください。');
 await db.prepare('INSERT INTO studio_reads(channel_id,account_id,last_seq)VALUES(?,?,?) ON CONFLICT(channel_id,account_id) DO UPDATE SET last_seq=max(last_seq,excluded.last_seq)').bind(channel.id,user.accountId,b.lastSeq).run();return studioJson({ok:true});
 }
 if(b.action==='notification.read'){
 if(typeof b.id!=='string')throw new RequestError('通知を確認してください。');await db.prepare('UPDATE studio_notifications SET read_at=? WHERE id=? AND recipient_id=? AND project_id=?').bind(now,b.id,user.accountId,project.id).run();return studioJson({ok:true});
 }
 studioAdmin(user);
 if(b.action==='channel.defaults'){
 await db.batch([...['general','frontend','backend','bugs','ideas'].map(name=>db.prepare('INSERT OR IGNORE INTO studio_channels(id,project_id,name,created_by,created_at)VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),project.id,name,user.accountId,now)),touchStudio(project.id)]);return studioJson({ok:true});
 }
 if(b.action==='channel.create'){
 if(typeof b.name!=='string'||! /^[\p{L}\p{N}][\p{L}\p{N}_-]{0,39}$/u.test(b.name))throw new RequestError('チャンネル名は40文字以内で指定してください。');
 const id=crypto.randomUUID();await db.batch([db.prepare('INSERT INTO studio_channels(id,project_id,name,created_by,created_at)VALUES(?,?,?,?,?)').bind(id,project.id,b.name.toLowerCase(),user.accountId,now),studioLog(project.id,user,'channel.create',id),touchStudio(project.id)]);return studioJson({ok:true,id});
 }
 if(b.action==='channel.archive'){
 const channel=await studioChannel(user,String(b.channelId||''));if(channel.project_id!==project.id||typeof b.archived!=='boolean')throw new RequestError('チャンネルを確認してください。');await db.batch([db.prepare('UPDATE studio_channels SET archived_at=? WHERE id=?').bind(b.archived?now:null,channel.id),studioLog(project.id,user,'channel.archive',channel.id),touchStudio(project.id)]);return studioJson({ok:true});
 }
 throw new RequestError('操作を確認してください。');
 }catch(e){return studioError(e)}}
