import {siteAdminUser} from '@/lib/site-access';
import {readJson,RequestError} from '@/lib/request-security';
import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';
import {unreadAfter} from '@/lib/workspace-cursors';
import {activeStudioAccount} from '@/lib/studio-access';
import {sameOrigin,rateLimit} from '@/lib/admin-auth';
export const dynamic='force-dynamic';
const json=(v:unknown,status=200)=>NextResponse.json(v,{status,headers:{'Cache-Control':'no-store'}});
async function participant(conversation:string,member:string) {return !!await env.DB!.prepare('SELECT member_id FROM direct_conversation_participants WHERE conversation_id=? AND member_id=?').bind(conversation,member).first();}
export async function GET(req:Request) {
 const u=await siteAdminUser();if(!u)return json({error:'Unauthorized'},401);
 const db=env.DB!, channel=new URL(req.url).searchParams.get('channel')||'team';
 if(channel!=='team'&&!await participant(channel,u.accountId))return json({error:'Private conversation'},403);
 const q=new URL(req.url).searchParams;let requestedIds:string[]=[];if(q.has('ids')){try{requestedIds=JSON.parse(q.get('ids')!)}catch{return json({error:'Invalid message IDs'},400)}if(!Array.isArray(requestedIds)||!requestedIds.length||requestedIds.length>100||requestedIds.some(id=>typeof id!=='string'||!id||id.length>100))return json({error:'Invalid message IDs'},400);}
 const selected=requestedIds.length?` AND t.id IN (${requestedIds.map(()=>'?').join(',')})`:'';
 const before=q.get('before');
 const cutoff=before?await db.prepare(`SELECT rowid AS seq,created_at,id FROM ${channel==='team'?'team_messages':'direct_messages'} WHERE id=?${channel==='team'?'':' AND conversation_id=?'}`).bind(...(channel==='team'?[before]:[before,channel])).first<{seq:number;created_at:string;id:string}>():null;
 if(before&&!cutoff)return json({error:'ページ指定を確認してください。'},400);
 const older=cutoff?' AND t.rowid < ?':'';
 const args=cutoff?[cutoff.seq]:[];
 const [messages,people,conversations,activity,count,unread]=await Promise.all([
   channel==='team'?db.prepare(`SELECT t.*,t.rowid AS seq,a.display_name,a.avatar_url FROM team_messages t JOIN member_accounts a ON a.id=t.sender_id WHERE 1=1${older}${selected} ORDER BY t.rowid DESC LIMIT 100`).bind(...args,...requestedIds).all():db.prepare(`SELECT t.*,t.rowid AS seq,a.display_name,a.avatar_url FROM direct_messages t JOIN member_accounts a ON a.id=t.sender_id WHERE conversation_id=?${older}${selected} ORDER BY t.rowid DESC LIMIT 100`).bind(channel,...args,...requestedIds).all(),
   db.prepare(`SELECT a.id,a.public_member_id,a.display_name,a.avatar_url,a.bio FROM member_accounts a LEFT JOIN allowed_emails e ON e.email=a.email AND e.public_member_id=a.public_member_id AND e.disabled_at IS NULL WHERE ${activeStudioAccount} ORDER BY a.display_name,a.id`).all(),
   db.prepare(`SELECT c.id,a.id AS peer_id,a.display_name,(SELECT count(*) FROM direct_messages d LEFT JOIN message_reads reads ON reads.member_id=? AND reads.channel=c.id WHERE d.conversation_id=c.id AND d.sender_id != ? AND d.deleted_at IS NULL AND ${unreadAfter('direct_messages','d','reads.read_at')}) AS unread FROM direct_conversations c JOIN direct_conversation_participants mine ON mine.conversation_id=c.id AND mine.member_id=? JOIN direct_conversation_participants other ON other.conversation_id=c.id AND other.member_id!=? JOIN member_accounts a ON a.id=other.member_id`).bind(u.accountId,u.accountId,u.accountId,u.accountId).all(),
   db.prepare('SELECT id,label,kind,created_at,actor_name FROM activity ORDER BY created_at DESC LIMIT 15').all(),
   db.prepare('SELECT count(*) AS total FROM team_messages').first(),
   db.prepare(`SELECT count(*) AS total FROM team_messages m LEFT JOIN message_reads reads ON reads.member_id=? AND reads.channel='team' WHERE m.sender_id!=? AND m.deleted_at IS NULL AND ${unreadAfter('team_messages','m','reads.read_at')}`).bind(u.accountId,u.accountId).first()
 ]);
 const messageIds=messages.results.map((m:any)=>m.id);const pageReactions=channel==='team'&&messageIds.length?(await db.prepare(`SELECT * FROM message_reactions WHERE message_id IN (${messageIds.map(()=>'?').join(',')})`).bind(...messageIds).all()).results:[];const attachments=messageIds.length?(await db.prepare(`SELECT id,${channel==='team'?'team_message_id':'direct_message_id'} AS message_id,filename,mime,bytes FROM studio_files WHERE ${channel==='team'?'team_message_id':'direct_message_id'} IN (${messageIds.map(()=>'?').join(',')})`).bind(...messageIds).all()).results:[];
 return json({files:attachments,messages:messages.results.reverse(),people:people.results,conversations:conversations.results,reactions:pageReactions,activity:activity.results,count,unread});
}
export async function POST(req:Request) {
 if(!sameOrigin(req))return json({error:'Invalid origin'},403);
 const u=await siteAdminUser();if(!u)return json({error:'Unauthorized'},401);
 try{
 const db=env.DB!, b:any=await readJson(req); try{await rateLimit('chat:'+u.accountId,120,60000)}catch{throw new RequestError('操作が多すぎます。少し待って再試行してください。',429)};
 if(b.action==='conversation') {
  const peer=String(b.peer||'');if(peer===u.accountId||!await db.prepare(`SELECT a.id FROM member_accounts a LEFT JOIN allowed_emails e ON e.email=a.email AND e.public_member_id=a.public_member_id AND e.disabled_at IS NULL WHERE a.id=? AND ${activeStudioAccount}`).bind(peer).first())throw new RequestError('Choose another activated member.');
  const pair=[peer,u.accountId].sort().join(':'), id=crypto.randomUUID();
  await db.batch([db.prepare('INSERT INTO direct_conversations (id,pair_key,created_at) VALUES (?,?,?) ON CONFLICT(pair_key) DO NOTHING').bind(id,pair,new Date().toISOString()),... [peer,u.accountId].map(m=>db.prepare('INSERT OR IGNORE INTO direct_conversation_participants (conversation_id,member_id) SELECT id,? FROM direct_conversations WHERE pair_key=?').bind(m,pair))]);
  return json(await db.prepare('SELECT id FROM direct_conversations WHERE pair_key=?').bind(pair).first());
 }
 const channel=String(b.channel||'team');
 if(channel!=='team'&&!await participant(channel,u.accountId))return json({error:'Private conversation'},403);
 const table=channel==='team'?'team_messages':'direct_messages',now=new Date().toISOString();
 if(b.action==='read') {
  if(typeof b.readAt!=='string'||Number.isNaN(Date.parse(b.readAt))||Date.parse(b.readAt)>Date.parse(now))throw new RequestError('Invalid read cursor');
  if(b.lastId!==undefined&&(typeof b.lastId!=='string'||b.lastId.length>100))throw new RequestError('Invalid read cursor');
  const row=await db.prepare(`SELECT rowid AS seq,id,created_at FROM ${table} WHERE ${b.lastId!==undefined?'id=?':'created_at<=?'}${channel==='team'?'':' AND conversation_id=?'} ORDER BY rowid DESC LIMIT 1`).bind(b.lastId??new Date(b.readAt).toISOString(),...(channel==='team'?[]:[channel])).first<{seq:number;id:string;created_at:string}>();
  if(!row){if(b.lastId!==undefined)throw new RequestError('Invalid read cursor');return json({ok:true});}
  if(b.lastId!==undefined&&Date.parse(row.created_at)!==Date.parse(b.readAt))throw new RequestError('Invalid read cursor');
  await db.prepare(`INSERT INTO message_reads (member_id,channel,read_at) VALUES (?,?,?) ON CONFLICT(member_id,channel) DO UPDATE SET read_at=excluded.read_at WHERE CASE WHEN message_reads.read_at LIKE 'id:%' THEN COALESCE((SELECT rowid FROM ${table} WHERE id=substr(message_reads.read_at,4)),0)<? ELSE message_reads.read_at<=? END`).bind(u.accountId,channel,'id:'+row.id,row.seq,row.created_at).run();return json({ok:true});
 }
 if(b.action==='react') {
  if(channel!=='team'||!['♡','🎀','✨','👍','🎉'].includes(b.emoji))throw new RequestError('Invalid reaction');
  if(!await db.prepare('SELECT id FROM team_messages WHERE id=?').bind(String(b.id)).first())throw new RequestError('Message not found');
  if(b.remove)await db.prepare('DELETE FROM message_reactions WHERE message_id=? AND member_id=? AND emoji=?').bind(b.id,u.accountId,b.emoji).run();else await db.prepare('INSERT OR IGNORE INTO message_reactions (message_id,member_id,emoji) VALUES (?,?,?)').bind(b.id,u.accountId,b.emoji).run();return json({ok:true});
 }
 if(b.action==='delete'||b.action==='edit') {
  const message=await db.prepare(`SELECT updated_at,deleted_at,sender_id${channel==='team'?'':',conversation_id'} FROM ${table} WHERE id=?`).bind(String(b.id)).first<{updated_at:string;sender_id:string;deleted_at?:string;conversation_id?:string}>();
  if(!message||message.deleted_at||message.sender_id!==u.accountId||(channel!=='team'&&message.conversation_id!==channel))return json({error:'You may only change your own messages in this conversation.'},403);
  const content=String(b.content||'').trim();if(b.action==='edit'&&(!content||content.length>4000))throw new RequestError('Write 1–4000 characters.');
  // Tombstones retain reply links and chronology.
  if(b.updatedAt!==undefined&&typeof b.updatedAt!=='string')throw new RequestError('変更前のメッセージを確認してください。');
  const changedAt=new Date(Math.max(Date.parse(now),Date.parse(message.updated_at)+1)).toISOString();const updated=await db.prepare(`UPDATE ${table} SET content=?,updated_at=?,deleted_at=? WHERE id=? AND sender_id=? AND deleted_at IS NULL ${b.updatedAt!==undefined?'AND updated_at=?':''}`).bind(b.action==='delete'?'':content,changedAt,b.action==='delete'?changedAt:null,b.id,u.accountId,...(b.updatedAt!==undefined?[b.updatedAt]:[])).run();if(!updated.meta.changes)throw new RequestError('他の変更が保存されています。再読み込みしてください。',409);return json({ok:true});
 }
 if(b.action!=='send')throw new RequestError('Unknown action');
 const content=String(b.content||'').trim(),fileIds=Array.isArray(b.fileIds)?[...new Set(b.fileIds)]:[];
 if(content.length>4000||!content&&!fileIds.length||fileIds.length>5||fileIds.some(id=>typeof id!=='string'||id.length>100))throw new RequestError('Write a message or choose up to 5 files.');
 const client=typeof b.clientId==='string'&&/^[a-zA-Z0-9_-]{16,100}$/.test(b.clientId)?b.clientId:null;
 if(client){const old=await db.prepare(`SELECT id${channel==='team'?'':',conversation_id'} FROM ${table} WHERE sender_id=? AND client_id=?`).bind(u.accountId,client).first<any>();if(old){if(channel!=='team'&&old.conversation_id!==channel)throw new RequestError('Client ID is already used',409);return json({ok:true,id:old.id})}}
 const reply=channel==='team'&&b.replyTo?String(b.replyTo):null;if(reply&&!await db.prepare('SELECT id FROM team_messages WHERE id=?').bind(reply).first())throw new RequestError('Reply target not found.');
 const id=crypto.randomUUID(),kind=channel==='team'?'team':'dm',fileColumn=channel==='team'?'team_message_id':'direct_message_id';
 const predicate=fileIds.length?`AND (SELECT count(*) FROM studio_files WHERE id IN (${fileIds.map(()=>'?').join(',')}) AND uploaded_by=? AND scope_kind=? AND scope_id=? AND ${fileColumn} IS NULL AND created_at>?)=?`:'';
 const values=channel==='team'?[id,u.accountId,content,now,now,reply,client]:[id,channel,u.accountId,content,now,now,client];
 const columns=channel==='team'?'id,sender_id,content,created_at,updated_at,reply_to_message_id,client_id':'id,conversation_id,sender_id,content,created_at,updated_at,client_id';
 const result=await db.batch([db.prepare(`INSERT INTO ${table}(${columns}) SELECT ${values.map(()=>'?').join(',')} WHERE 1=1 ${predicate} ON CONFLICT(sender_id,client_id) DO NOTHING`).bind(...values,...(fileIds.length?[...fileIds,u.accountId,kind,channel,new Date(Date.now()-86400000).toISOString(),fileIds.length]:[])),...(fileIds.length?[db.prepare(`UPDATE studio_files SET ${fileColumn}=? WHERE id IN (${fileIds.map(()=>'?').join(',')}) AND EXISTS(SELECT 1 FROM ${table} WHERE id=?)`).bind(id,...fileIds,id)]:[])]);
 if(!result[0].meta.changes){if(client){const saved=await db.prepare(`SELECT id${channel==='team'?'':',conversation_id'} FROM ${table} WHERE sender_id=? AND client_id=?`).bind(u.accountId,client).first<any>();if(saved){if(channel!=='team'&&saved.conversation_id!==channel)throw new RequestError('Client ID is already used',409);return json({ok:true,id:saved.id});}}throw new RequestError('Attachment ownership, destination or expiry mismatch');}return json({ok:true,id});
 }catch(e){return json({error:e instanceof RequestError?e.message:'メッセージを処理できませんでした。再試行してください。'},e instanceof RequestError?e.status:503);}
}
