import {contributionCanvas} from './critour-canvas';
import type {HelpRequest,Contribution,HistoryEntry,Reply,Publication,ImpactEntry,Notice,Visibility} from './critour-types';
import {digest} from './workspace-security';
import {analyticsWrite} from './critour-analytics';
import {env} from 'cloudflare:workers';
import type {StudioActor} from './studio-access';
import {visibleListing} from './codemate-showcase';
import {shortText} from './codemate-policy';
import {RequestError} from './request-security';
import {clientKey} from './studio-validation';
type RequestRow=HelpRequest&{listing_id:string;owner_id:string};
type ContributionRow=Contribution&{mutation:string;listing_id:string;owner_id:string;created_at:string;updated_at:string};
const db=()=>env.DB!;
const stamp=()=>new Date().toISOString();
const id=(v:unknown)=>shortText(v,100);
const safeBody=(v:unknown)=>{const s=shortText(v,4000);if(/[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\d[ -]?){10,}/i.test(s))throw new RequestError("連絡先などの個人情報は書かないでください。");return s;};
async function owner(user:StudioActor,listing:string){const s=await visibleListing(user,listing);if(s.project_owner!==user.accountId)throw new RequestError("この操作はプロジェクトの管理者のみ行えます。",403);return s;}
function notice(recipient:string,listing:string,contribution:string|null,kind:string,title:string,key:string,guard:string){
 return db().prepare(`INSERT INTO cr_notifications(id,recipient_id,listing_id,contribution_id,kind,title,event_key,created_at) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM cr_contributions WHERE id=? AND mutation=?) ON CONFLICT(recipient_id,event_key) DO NOTHING`).bind(crypto.randomUUID(),recipient,listing,contribution,kind,title,key,stamp(),contribution,guard);
}
export async function collabRead(user:StudioActor,q:URLSearchParams){
 const listing=q.get('listing');
 if(listing){
  const s=await visibleListing(user,id(listing));
  const requests=await db().prepare(`SELECT r.id,r.kind,r.title,r.instructions,r.minutes,r.difficulty,r.no_code,r.status,COALESCE(d.required_skills,'') AS required_skills,
 CASE WHEN r.status='open' AND EXISTS(SELECT 1 FROM cr_contributions c WHERE c.request_id=r.id AND c.status!='implemented' AND COALESCE(c.decision,'')!='declined') THEN 'in_progress' ELSE r.status END AS progress
 FROM cr_requests r LEFT JOIN cr_request_details d ON d.request_id=r.id WHERE r.listing_id=? ORDER BY r.status!='open',r.difficulty!='beginner',r.created_at DESC LIMIT 100`).bind(listing).all<HelpRequest>();
  const contributions=await db().prepare(`SELECT c.*,r.title AS request_title FROM cr_contributions c JOIN cr_requests r ON r.id=c.request_id WHERE r.listing_id=? AND (c.author_id=? OR ?=1) AND NOT EXISTS(SELECT 1 FROM cm_showcase_blocks x WHERE (x.account_id=? AND x.blocked_id=c.author_id) OR (x.account_id=c.author_id AND x.blocked_id=?)) ORDER BY c.updated_at DESC LIMIT 100`).bind(listing,user.accountId,s.project_owner===user.accountId?1:0,user.accountId,user.accountId).all<ContributionRow>();
  const allowedIds=new Set(contributions.results.map(c=>c.id));
  const history=await db().prepare(`SELECT h.* FROM cr_history h JOIN cr_contributions c ON c.id=h.contribution_id JOIN cr_requests r ON r.id=c.request_id WHERE r.listing_id=? AND (c.author_id=? OR ?=1) ORDER BY h.created_at,h.version LIMIT 500`).bind(listing,user.accountId,s.project_owner===user.accountId?1:0).all<HistoryEntry>();
  const replies=await db().prepare(`SELECT x.id,x.contribution_id,x.body,x.created_at,x.author_id=? AS mine FROM cr_replies x JOIN cr_contributions c ON c.id=x.contribution_id JOIN cr_requests r ON r.id=c.request_id WHERE r.listing_id=? AND (c.author_id=? OR ?=1) ORDER BY x.created_at LIMIT 500`).bind(user.accountId,listing,user.accountId,s.project_owner===user.accountId?1:0).all<Reply>();
  const publication=await db().prepare('SELECT token,published,creator_label FROM cr_publications WHERE listing_id=?').bind(listing).first<Publication>();
  const publishedImpacts=await db().prepare('SELECT u.token,u.contribution_id,u.published FROM cr_impact_publications u JOIN cr_contributions c ON c.id=u.contribution_id JOIN cr_requests r ON r.id=c.request_id WHERE r.listing_id=?').bind(listing).all<Publication>();
  return {canvas:await contributionCanvas(user.accountId,listing,true),publication,publishedImpacts:publishedImpacts.results,owner:s.project_owner===user.accountId,requests:requests.results,contributions:contributions.results.map(c=>({id:c.id,request_id:c.request_id,author_id:c.author_id,body:c.body,feedback_kind:c.feedback_kind,status:c.status,decision:c.decision,improvement:c.improvement,version:c.version,request_title:c.request_title})),history:history.results.filter(h=>allowedIds.has(h.contribution_id)),replies:replies.results.filter(r=>allowedIds.has(r.contribution_id))};
 }
 // Every item is rechecked against publication and block rules before display.
 const raw=await db().prepare(`SELECT c.id,c.status,c.improvement,c.updated_at,r.title,s.id AS listing_id,s.title AS project_title FROM cr_contributions c JOIN cr_requests r ON r.id=c.request_id JOIN cm_showcase s ON s.id=r.listing_id WHERE c.author_id=? AND c.status IN ('adopted','implemented') ORDER BY c.updated_at DESC LIMIT 100`).bind(user.accountId).all<ImpactEntry>();
 const impact=[];for(const c of raw.results){try{await visibleListing(user,c.listing_id);impact.push(c)}catch(e){if(!(e instanceof RequestError&&e.status===404))throw e;}}
 const rows=await db().prepare(`SELECT id,listing_id,contribution_id,kind,title,read_at,created_at FROM cr_notifications WHERE recipient_id=? ORDER BY read_at IS NOT NULL,CASE kind WHEN 'implemented' THEN 0 WHEN 'adopted' THEN 1 WHEN 'reply' THEN 2 ELSE 3 END,created_at DESC LIMIT 50`).bind(user.accountId).all<Notice>();
 const notifications=[];for(const n of rows.results){try{await visibleListing(user,n.listing_id);notifications.push(n)}catch(e){if(!(e instanceof RequestError&&e.status===404))throw e;}}
 const visibility=await db().prepare('SELECT public_label,show_name FROM cr_public_profiles WHERE account_id=?').bind(user.accountId).first<Visibility>();
 const publications=await db().prepare('SELECT u.token,u.contribution_id FROM cr_impact_publications u JOIN cr_contributions c ON c.id=u.contribution_id WHERE c.author_id=? AND u.published=1').bind(user.accountId).all<Publication>();
 return {canvas:await contributionCanvas(user.accountId,null),impact:impact.map(c=>({...c,shareToken:publications.results.find(u=>u.contribution_id===c.id)?.token})),notifications,visibility};
}
export async function collabAction(user:StudioActor,b:Record<string,unknown>){
 const at=stamp(),action=b.action;
 if(action==='notification.read'){await db().prepare('UPDATE cr_notifications SET read_at=COALESCE(read_at,?) WHERE id=? AND recipient_id=?').bind(at,id(b.id),user.accountId).run();return {ok:true};}
 if(action==='feedback.promote'){
  const listing=id(b.listingId),s=await owner(user,listing),source=id(b.commentId);
  const comment=await db().prepare('SELECT c.* FROM cm_showcase_comments c WHERE c.id=? AND c.listing_id=? AND c.hidden=0 AND NOT EXISTS(SELECT 1 FROM cm_showcase_blocks x WHERE (x.account_id=? AND x.blocked_id=c.author_id) OR (x.account_id=c.author_id AND x.blocked_id=?))').bind(source,listing,user.accountId,user.accountId).first<{author_id:string;body:string;kind:string;created_at:string}>();
  if(!comment)throw new RequestError("フィードバックが見つかりません。",404);
  if(comment.author_id===user.accountId)throw new RequestError("ほかの参加者から届いたフィードバックを選んでください。",403);
  const cid='feedback-'+await digest(source),rid='review-'+await digest(source),kind=comment.kind==='love'?'good':comment.kind==='confused'?'improve':'idea';
  await db().batch([
   db().prepare("INSERT INTO cr_requests(id,listing_id,owner_id,kind,title,instructions,minutes,difficulty,no_code,status,created_at,updated_at)VALUES(?,?,?,'idea','以前のフィードバックを確認',?,1,'beginner',1,'completed',?,?) ON CONFLICT(id) DO NOTHING").bind(rid,listing,user.accountId,'フィードバック：'+s.title+' · '+s.version_label,at,at),
   db().prepare('INSERT INTO cr_contributions(id,request_id,author_id,body,feedback_kind,mutation,created_at,updated_at)VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(request_id,author_id) DO NOTHING').bind(cid,rid,comment.author_id,comment.body,kind,cid,comment.created_at,at),
   db().prepare("INSERT INTO cr_history(id,contribution_id,actor_id,status,note,version,created_at)VALUES(?,?,?,'submitted','以前のフィードバックを確認対象に追加しました。投稿者は変わりません。',1,?) ON CONFLICT(contribution_id,version) DO NOTHING").bind(crypto.randomUUID(),cid,user.accountId,at),
   db().prepare("INSERT INTO cr_feedback_links(contribution_id,source_kind,source_id,linked_by,linked_at)VALUES(?,'showcase',?,?,?) ON CONFLICT(source_kind,source_id) DO NOTHING").bind(cid,source,user.accountId,at),
   notice(comment.author_id,listing,cid,'reviewed','Your feedback is now linked to an improvement review','feedback-linked:'+cid,cid)
  ]);return {ok:true,id:cid};
 }
 if(action==='request.create'){
  const listing=id(b.listingId);await owner(user,listing);
  if(!['test','idea','design','code'].includes(String(b.kind))||!['beginner','intermediate','advanced'].includes(String(b.difficulty))||typeof b.minutes!=='number'||!Number.isInteger(b.minutes)||b.minutes<1||b.minutes>480)throw new RequestError("参加方法と難しさを選び、目安時間を1〜480分で入力してください。");
  const key=clientKey(b.clientId),requestId='cr-'+await digest(user.accountId+':'+key),title=shortText(b.title,100),instructions=safeBody(b.instructions),skills=shortText(b.skills||'',240,false);
  const old=await db().prepare('SELECT * FROM cr_requests WHERE id=?').bind(requestId).first<RequestRow>();
  if(old){const detail=await db().prepare('SELECT required_skills FROM cr_request_details WHERE request_id=?').bind(requestId).first<{required_skills:string}>();if((detail?.required_skills||'')!==skills)throw new RequestError("同じ募集の送信がすでに処理されています。ページを開き直して確認してください。",409);if(old.listing_id!==listing||old.title!==title||old.instructions!==instructions||old.kind!==b.kind||old.minutes!==b.minutes||old.difficulty!==b.difficulty||old.no_code!==(b.noCode===true?1:0))throw new RequestError("同じ募集の送信がすでに処理されています。ページを開き直して確認してください。",409);return {ok:true,id:old.id};}
  await db().batch([db().prepare('INSERT INTO cr_requests(id,listing_id,owner_id,kind,title,instructions,minutes,difficulty,no_code,created_at,updated_at)VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(requestId,listing,user.accountId,b.kind,title,instructions,b.minutes,b.difficulty,b.noCode===true?1:0,at,at),
   db().prepare('INSERT INTO cr_request_details(request_id,required_skills)VALUES(?,?) ON CONFLICT(request_id) DO NOTHING').bind(requestId,skills),
   db().prepare(`INSERT INTO cr_notifications(id,recipient_id,listing_id,kind,title,event_key,created_at)
    SELECT lower(hex(randomblob(16))),a.id,?,'request','A new small collaboration task is open',?,?
    FROM member_accounts a WHERE a.id!=? AND a.disabled_at IS NULL
    AND (EXISTS(SELECT 1 FROM studio_project_members m JOIN cm_showcase s ON s.project_id=m.project_id WHERE s.id=? AND m.account_id=a.id)
      OR EXISTS(SELECT 1 FROM cr_contributions c JOIN cr_requests r ON r.id=c.request_id WHERE r.listing_id=? AND c.author_id=a.id))
    AND NOT EXISTS(SELECT 1 FROM cm_showcase_blocks x WHERE (x.account_id=a.id AND x.blocked_id=?) OR (x.account_id=? AND x.blocked_id=a.id))
    ON CONFLICT(recipient_id,event_key) DO NOTHING`).bind(listing,'request:'+requestId,at,user.accountId,listing,listing,user.accountId,user.accountId)
  ]);
  const detail=await db().prepare('SELECT required_skills FROM cr_request_details WHERE request_id=?').bind(requestId).first<{required_skills:string}>();
  const saved=await db().prepare('SELECT * FROM cr_requests WHERE id=?').bind(requestId).first<RequestRow>();if((detail?.required_skills||'')!==skills||saved.title!==title||saved.instructions!==instructions||saved.kind!==b.kind||saved.listing_id!==listing||saved.minutes!==b.minutes||saved.difficulty!==b.difficulty||saved.no_code!==(b.noCode===true?1:0))throw new RequestError("同じ募集の送信がすでに処理されています。ページを開き直して確認してください。",409);
  return {ok:true,id:requestId};
 }
 if(action==='request.close'){
  const r=await db().prepare('SELECT * FROM cr_requests WHERE id=?').bind(id(b.requestId)).first<RequestRow>();if(!r)throw new RequestError("タスクが見つかりません。",404);await owner(user,r.listing_id);
  if(!['completed','cancelled'].includes(String(b.status)))throw new RequestError("完了または取り消しを選んでください。");
  const result=await db().prepare("UPDATE cr_requests SET status=?,updated_at=? WHERE id=? AND status='open'").bind(b.status,at,r.id).run();if(!result.meta.changes)throw new RequestError("このタスクの募集はすでに終了しています。",409);return {ok:true};
 }
 if(action==='submit'){
  const r=await db().prepare('SELECT * FROM cr_requests WHERE id=?').bind(id(b.requestId)).first<RequestRow>();if(!r)throw new RequestError("タスクが見つかりません。",404);await visibleListing(user,r.listing_id);
  if(r.owner_id===user.accountId)throw new RequestError("ほかの作者が募集しているタスクを選んでください。",403);
  const body=safeBody(b.body),mutation=clientKey(b.clientId);if(!['good','idea','improve'].includes(String(b.kind)))throw new RequestError("フィードバックの種類を選んでください。");
  const old=await db().prepare('SELECT * FROM cr_contributions WHERE request_id=? AND author_id=?').bind(r.id,user.accountId).first<ContributionRow>();
  if(old){if(old.body!==body||old.feedback_kind!==b.kind)throw new RequestError("このタスクにはすでに投稿しています。",409);return {ok:true,id:old.id};}
  const cid=crypto.randomUUID();
  const result=await db().batch([
   db().prepare(`INSERT INTO cr_contributions(id,request_id,author_id,body,feedback_kind,mutation,created_at,updated_at) SELECT ?,?,?,?,?,?,?,? FROM cr_requests WHERE id=? AND status='open' ON CONFLICT(request_id,author_id) DO NOTHING`).bind(cid,r.id,user.accountId,body,b.kind,mutation,at,at,r.id),
   db().prepare("INSERT INTO cr_history(id,contribution_id,actor_id,status,version,created_at) SELECT ?,id,author_id,'submitted',1,? FROM cr_contributions WHERE id=?").bind(crypto.randomUUID(),at,cid),
   notice(r.owner_id,r.listing_id,cid,'submitted','A contribution is ready to review','submitted:'+cid,mutation),
   ...(()=>{const w=analyticsWrite('contribution_submitted',r.listing_id,'submitted:'+cid,b.analytics,{id:cid,mutation});return w?[w]:[]})()
  ]);
  if(!result[0].meta.changes)throw new RequestError("募集が終了したか、すでに投稿済みです。ページを更新して確認してください。",409);return {ok:true,id:cid};
 }
 const c=await db().prepare('SELECT c.*,r.listing_id,r.owner_id FROM cr_contributions c JOIN cr_requests r ON r.id=c.request_id WHERE c.id=?').bind(id(b.contributionId)).first<ContributionRow>();if(!c)throw new RequestError("貢献が見つかりません。",404);await visibleListing(user,c.listing_id);
 const block=await db().prepare('SELECT 1 FROM cm_showcase_blocks WHERE (account_id=? AND blocked_id=?) OR (account_id=? AND blocked_id=?)').bind(user.accountId,c.author_id,c.author_id,user.accountId).first();if(block)throw new RequestError("この貢献は表示できません。",404);
 if(action==='report'){if(c.owner_id!==user.accountId&&c.author_id!==user.accountId)throw new RequestError("貢献が見つかりません。",404);await db().prepare('INSERT OR IGNORE INTO cm_showcase_reports(reporter_id,listing_id,target_id,reason,created_at)VALUES(?,?,?,?,?)').bind(user.accountId,c.listing_id,c.id,shortText(b.reason,300),at).run();return {ok:true};}
 if(action==='block'){if(c.owner_id!==user.accountId)throw new RequestError("参加者のブロックは、作品の管理者のみ行えます。",403);await db().prepare('INSERT OR IGNORE INTO cm_showcase_blocks(account_id,blocked_id)VALUES(?,?)').bind(user.accountId,c.author_id).run();return {ok:true};}
 if(action==='reply'){
  if(c.owner_id!==user.accountId&&c.author_id!==user.accountId)throw new RequestError("この投稿には返信できません。",403);
  const body=safeBody(b.body),key=clientKey(b.clientId),rid=crypto.randomUUID();
  const old=await db().prepare('SELECT body,contribution_id FROM cr_replies WHERE author_id=? AND client_id=?').bind(user.accountId,key).first<{body:string;contribution_id:string}>();if(old){if(old.body!==body||old.contribution_id!==c.id)throw new RequestError("この返信はすでに送信されています。ページを更新して確認してください。",409);return {ok:true};}
  await db().batch([db().prepare('INSERT INTO cr_replies(id,contribution_id,author_id,body,client_id,created_at)VALUES(?,?,?,?,?,?) ON CONFLICT(author_id,client_id) DO NOTHING').bind(rid,c.id,user.accountId,body,key,at),db().prepare(`INSERT INTO cr_notifications(id,recipient_id,listing_id,contribution_id,kind,title,event_key,created_at) SELECT ?,?,?,?,'reply','A reply to your contribution',?,? WHERE EXISTS(SELECT 1 FROM cr_replies WHERE id=?) ON CONFLICT(recipient_id,event_key) DO NOTHING`).bind(crypto.randomUUID(),c.author_id===user.accountId?c.owner_id:c.author_id,c.listing_id,c.id,'reply:'+rid,at,rid)]);return {ok:true};
 }
 await owner(user,c.listing_id);
 if(!Number.isInteger(b.version)||b.version!==c.version)throw new RequestError("この投稿の状態が変わりました。ページを更新してから確認してください。",409);
 let status:string,decision:string|null=c.decision,note='';
 if(action==='review'&&c.status==='submitted'){status='reviewed';}
 else if(action==='adopt'&&c.status==='reviewed'&&c.decision!=='declined'){status='adopted';decision='accepted';}
 else if(action==='decline'&&c.status==='reviewed'&&!c.decision){status='reviewed';decision='declined';note=safeBody(b.note);}
 else if(action==='implement'&&c.status==='adopted'){status='implemented';note=safeBody(b.improvement);}
 else throw new RequestError("現在の状態では、この操作はできません。",409);
 const mutation=crypto.randomUUID(),version=c.version+1;
 const result=await db().batch([
  db().prepare('UPDATE cr_contributions SET status=?,decision=?,improvement=?,version=version+1,mutation=?,updated_at=? WHERE id=? AND version=? AND status=?').bind(status,decision,action==='implement'?note:c.improvement,mutation,at,c.id,c.version,c.status),
  db().prepare('INSERT INTO cr_history(id,contribution_id,actor_id,status,note,version,created_at) SELECT ?,id,?,?,?,version,? FROM cr_contributions WHERE id=? AND mutation=?').bind(crypto.randomUUID(),user.accountId,status,note,at,c.id,mutation),
  notice(c.author_id,c.listing_id,c.id,status,decision==='declined'?'Your contribution was reviewed':`Your contribution was ${status}`,c.id+':'+version,mutation),
  ...(status==='adopted'?[db().prepare("INSERT OR IGNORE INTO cr_analytics(event_id,event,visitor,listing_id,source,occurred_at) SELECT ?,'contribution_accepted',a.visitor,a.listing_id,a.source,? FROM cr_analytics a WHERE a.event_id=? AND EXISTS(SELECT 1 FROM cr_contributions WHERE id=? AND mutation=?)").bind('accepted:'+c.id,Date.now(),'submitted:'+c.id,c.id,mutation)]:[])
 ]);if(!result[0].meta.changes)throw new RequestError("先に別の確認結果が保存されました。ページを更新して確認してください。",409);return {ok:true};
}
