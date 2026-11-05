import {env} from 'cloudflare:workers';
import type {StudioActor} from './studio-access';
import {codemateProject,codematePeople,codemateProjects,cmEvent} from './codemate-access';
import {RequestError} from './request-security';
import {shortText,previewUrl,feedbackKinds,nextTask,commitUrl} from './codemate-policy';
import {clientKey} from './studio-validation';
import {digest} from './workspace-security';
import {recentlyVerified} from './session-policy';
import {studioTaskAction} from './studio-collaboration';
const db=()=>env.DB!;
const now=()=>new Date().toISOString();
async function feedback(user:StudioActor,id:string){const f=await db().prepare('SELECT * FROM cm_feedback WHERE id=?').bind(id).first<any>();if(!f)throw new RequestError('感想が見つかりません。',404);await codemateProject(user,f.project_id);return f}
async function build(project:string,id:string){const b=await db().prepare('SELECT * FROM cm_builds WHERE id=? AND project_id=?').bind(id,project).first<any>();if(!b)throw new RequestError('作品バージョンが見つかりません。',404);return b}
export async function cmRead(user:StudioActor,q:URLSearchParams){
 const projects=await codemateProjects(user),projectId=q.get('projectId');
 if(!projectId)return {user:{accountId:user.accountId,displayName:user.displayName,isManager:user.isStudioAdmin},projects};
 const project=await codemateProject(user,projectId),people=await codematePeople(projectId);
 const [builds,tasks,feedbacks,replies,journeys,retests,events,visit,counts,channel,canvas]=await Promise.all([
 db().prepare('SELECT b.*,d.platform,d.device,d.recording_url,a.display_name AS author_name FROM cm_builds b LEFT JOIN cm_preview_details d ON d.build_id=b.id JOIN member_accounts a ON a.id=b.created_by WHERE b.project_id=? ORDER BY b.seq DESC LIMIT 100').bind(projectId).all(),
 db().prepare('SELECT * FROM studio_tasks WHERE project_id=? ORDER BY status=\'done\',due_date IS NULL,due_date,updated_at DESC LIMIT 200').bind(projectId).all<any>(),
 db().prepare('SELECT f.*,a.display_name AS author_name FROM cm_feedback f JOIN member_accounts a ON a.id=f.author_id WHERE f.project_id=? ORDER BY f.created_at DESC,f.id DESC LIMIT 500').bind(projectId).all(),
 db().prepare('SELECT r.*,a.display_name AS author_name FROM cm_replies r JOIN cm_feedback f ON f.id=r.feedback_id JOIN member_accounts a ON a.id=r.author_id WHERE f.project_id=? ORDER BY r.created_at DESC,r.id DESC LIMIT 500').bind(projectId).all(),
 db().prepare('SELECT j.* FROM cm_journeys j JOIN cm_feedback f ON f.id=j.feedback_id WHERE f.project_id=?').bind(projectId).all(),
 db().prepare('SELECT r.* FROM cm_retests r JOIN cm_feedback f ON f.id=r.feedback_id WHERE f.project_id=? ORDER BY r.created_at,r.id').bind(projectId).all(),
 db().prepare('SELECT e.*,a.display_name AS actor_name FROM cm_events e JOIN member_accounts a ON a.id=e.actor_id WHERE e.project_id=? ORDER BY e.seq DESC LIMIT 100').bind(projectId).all<any>(),
 db().prepare('SELECT last_seq FROM cm_visits WHERE project_id=? AND account_id=?').bind(projectId,user.accountId).first<any>(),
 db().prepare("SELECT count(*) AS total,sum(status='done') AS done FROM studio_tasks WHERE project_id=?").bind(projectId).first(),
 db().prepare("SELECT id FROM studio_channels WHERE project_id=? AND archived_at IS NULL ORDER BY name!='general',created_at LIMIT 1").bind(projectId).first<any>(),
 project.role==='tester' ? null : db().prepare(
   'SELECT c.slot,t.id,t.title,t.status,t.due_date,t.assignee_ids FROM cm_canvas_cells c JOIN studio_tasks t ON t.id=c.task_id AND t.project_id=c.project_id WHERE c.project_id=? ORDER BY c.slot'
 ).bind(projectId).all<any>()
 ]);
 const taskRows=tasks.results.map(t=>({...t,assigneeIds:JSON.parse(t.assignee_ids)}));
 // Tester views contain only shared work and feedback, not internal task bodies.
 const tester=project.role==='tester';
 const {id,name,description,kind,next_goal,role,created_by,archived_at}=project;
 const visibleEvents=events.results.filter(e=>!tester||!e.kind.startsWith('task.'));
 return {project:{id,name,description,kind,next_goal,role,created_by,archived_at},people,builds:builds.results.map(b=>{const {client_id,...shared}=b as any;if(tester){delete shared.task_id;delete shared.commit_url;}return shared;}),tasks:tester?[]:taskRows,feedback:feedbacks.results,replies:replies.results,journeys:journeys.results.map(j=>tester?{feedback_id:(j as any).feedback_id,hasTask:true}:j),retests:retests.results,unseen:visibleEvents.filter(e=>e.seq>(visit?.last_seq||0)&&e.actor_id!==user.accountId),lastSeen:visit?.last_seq||0,latestSeq:visibleEvents[0]?.seq||0,nextTask:tester?null:nextTask(taskRows,user.accountId),counts,canvas:canvas?.results.map(t=>({...t,assigneeIds:JSON.parse(t.assignee_ids)}))??[],channelId:tester?null:channel?.id||null,limits:{builds:100,tasks:200,feedback:500,events:100}};
}
export async function cmAction(user:StudioActor,b:Record<string,any>,origin:string){
 const action=shortText(b.action,50),projectId=typeof b.projectId==='string'?b.projectId:'';
 if(action==='invite.accept'){
 const token=shortText(b.token,200),hash=await digest(token);const invite=await db().prepare('SELECT * FROM cm_invites WHERE token_hash=? AND expires_at>? AND revoked_at IS NULL AND used_at IS NULL').bind(hash,Date.now()).first<any>();
 if(!invite)throw new RequestError('招待の期限が切れたか、使用済みです。',410);
 const p=await db().prepare('SELECT id FROM studio_projects WHERE id=? AND archived_at IS NULL').bind(invite.project_id).first();if(!p)throw new RequestError('参加できません。',404);
 const already=await db().prepare('SELECT 1 FROM cm_roles WHERE project_id=? AND account_id=? UNION SELECT 1 FROM studio_project_members WHERE project_id=? AND account_id=?').bind(invite.project_id,user.accountId,invite.project_id,user.accountId).first();if(already)throw new RequestError('このプロジェクトには参加済みです。',409);
 // All joins are conditional on the winner of the single-use compare-and-swap.
 const consumed=await db().batch([
 db().prepare('UPDATE cm_invites SET used_by=?,used_at=? WHERE id=? AND used_at IS NULL AND revoked_at IS NULL AND expires_at>?').bind(user.accountId,Date.now(),invite.id,Date.now()),
 db().prepare('INSERT OR IGNORE INTO cm_roles(project_id,account_id,role) SELECT project_id,?,role FROM cm_invites WHERE id=? AND used_by=?').bind(user.accountId,invite.id,user.accountId),
 ...(invite.role==='creator'?[db().prepare('INSERT OR IGNORE INTO studio_project_members(project_id,account_id,added_by,joined_at) SELECT project_id,?,created_by,? FROM cm_invites WHERE id=? AND used_by=?').bind(user.accountId,now(),invite.id,user.accountId)]:[])
 ]);if(!consumed[0].meta.changes)throw new RequestError('この招待は使用済みです。',409);return {ok:true,projectId:invite.project_id};
 }
 if(action==='project.create'){
 if(!user.isStudioAdmin)throw new RequestError('既存のWorkspace管理者が作成できます。',403);
 const name=shortText(b.name,100),description=shortText(b.description||'',4000,false),kind=b.kind;if(!['web','ios'].includes(kind))throw new RequestError('WebまたはiOSを選んでください。');
 const id=crypto.randomUUID(),at=now();await db().batch([db().prepare('INSERT INTO studio_projects(id,name,description,created_by,created_at,updated_at)VALUES(?,?,?,?,?,?)').bind(id,name,description,user.accountId,at,at),db().prepare('INSERT INTO cm_project_settings(project_id,kind)VALUES(?,?)').bind(id,kind),db().prepare('INSERT INTO studio_project_members(project_id,account_id,added_by,joined_at)VALUES(?,?,?,?)').bind(id,user.accountId,user.accountId,at),db().prepare("INSERT INTO studio_channels(id,project_id,name,created_by,created_at)VALUES(?,?,'general',?,?)").bind(crypto.randomUUID(),id,user.accountId,at),cmEvent(id,user,'project.created',id)]);return {ok:true,id};
 }
 const p=await codemateProject(user,projectId);
 if(p.archived_at)throw new RequestError('アーカイブ済みです。',409);
 if(action==='visit'){
 const seq=b.seq;if(!Number.isSafeInteger(seq)||seq<0||seq>0&&!await db().prepare('SELECT 1 FROM cm_events WHERE project_id=? AND seq=?').bind(projectId,seq).first())throw new RequestError('確認した履歴を指定してください。');
 await db().prepare('INSERT INTO cm_visits(project_id,account_id,last_seq)VALUES(?,?,?) ON CONFLICT(project_id,account_id) DO UPDATE SET last_seq=max(cm_visits.last_seq,excluded.last_seq)').bind(projectId,user.accountId,seq).run();return {ok:true};
 }
 if(action==='feedback.create'){
 const target=await build(projectId,shortText(b.buildId,100)),kind=b.kind,body=shortText(b.body,2000),key=clientKey(b.clientId);if(!feedbackKinds.includes(kind))throw new RequestError('感想の種類を選んでください。');
 const existing=await db().prepare('SELECT * FROM cm_feedback WHERE author_id=? AND client_id=?').bind(user.accountId,key).first<any>();if(existing){if(existing.build_id!==target.id||existing.body!==body||existing.kind!==kind)throw new RequestError('送信IDが別の感想で使われています。',409);return {ok:true,id:existing.id};}
 const id=crypto.randomUUID(),at=now();await db().batch([db().prepare('INSERT INTO cm_feedback(id,project_id,build_id,kind,body,author_id,client_id,created_at)VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(author_id,client_id) DO NOTHING').bind(id,projectId,target.id,kind,body,user.accountId,key,at),db().prepare("INSERT INTO cm_events(project_id,actor_id,kind,target_id,build_id,created_at) SELECT ?,?,'feedback.created',?,?,? WHERE EXISTS(SELECT 1 FROM cm_feedback WHERE id=?)").bind(projectId,user.accountId,id,target.id,at,id)]);
 const saved=await db().prepare('SELECT * FROM cm_feedback WHERE author_id=? AND client_id=?').bind(user.accountId,key).first<any>();if(saved.build_id!==target.id||saved.body!==body||saved.kind!==kind)throw new RequestError('送信IDを確認してください。',409);return {ok:true,id:saved.id};
 }
 if(action==='feedback.reply'){
 const f=await feedback(user,shortText(b.feedbackId,100));if(f.project_id!==projectId)throw new RequestError('感想が見つかりません。',404);
 const body=shortText(b.body,2000),key=clientKey(b.clientId),id=crypto.randomUUID();const old=await db().prepare('SELECT * FROM cm_replies WHERE author_id=? AND client_id=?').bind(user.accountId,key).first<any>();if(old){if(old.feedback_id!==f.id||old.body!==body)throw new RequestError('送信IDを確認してください。',409);return {ok:true};}
 await db().batch([db().prepare('INSERT INTO cm_replies(id,feedback_id,author_id,body,client_id,created_at)VALUES(?,?,?,?,?,?) ON CONFLICT(author_id,client_id) DO NOTHING').bind(id,f.id,user.accountId,body,key,now()),db().prepare("INSERT INTO cm_events(project_id,actor_id,kind,target_id,build_id,created_at) SELECT ?,?,'feedback.reply',?,?,? WHERE EXISTS(SELECT 1 FROM cm_replies WHERE id=?)").bind(projectId,user.accountId,f.id,f.build_id,now(),id)]);return {ok:true};
 }
 if(action==='retest.answer'){
 const r=await db().prepare('SELECT r.*,f.project_id FROM cm_retests r JOIN cm_feedback f ON f.id=r.feedback_id WHERE r.id=? AND f.project_id=?').bind(shortText(b.retestId,100),projectId).first<any>();if(!r)throw new RequestError('再テストが見つかりません。',404);if(r.tester_id!==user.accountId)throw new RequestError('依頼された本人が回答してください。',403);if(!['better','confused'].includes(b.outcome))throw new RequestError('結果を選んでください。');
 const changed=await db().batch([db().prepare("UPDATE cm_retests SET outcome=?,note=?,answered_at=? WHERE id=? AND outcome='waiting'").bind(b.outcome,shortText(b.note||'',2000,false),now(),r.id),db().prepare("INSERT INTO cm_events(project_id,actor_id,kind,target_id,build_id,created_at) SELECT ?,?,'retest.answered',?,?,? WHERE changes()>0").bind(projectId,user.accountId,r.feedback_id,r.build_id,now())]);if(!changed[0].meta.changes)throw new RequestError('回答済みです。',409);return {ok:true};
 }
 await codemateProject(user,projectId,true);
 if(action==='canvas.link'||action==='canvas.unlink'){
   const taskId=shortText(b.taskId,100);
   if(action==='canvas.unlink'){
     await db().prepare('DELETE FROM cm_canvas_cells WHERE project_id=? AND task_id=?').bind(projectId,taskId).run();
     return {ok:true};
   }
   if(!p.next_goal?.trim())throw new RequestError('先に次の制作目標を設定してください。');
   if(!await db().prepare('SELECT 1 FROM studio_tasks WHERE project_id=? AND id=?').bind(projectId,taskId).first()){
     throw new RequestError('このプロジェクトのタスクが見つかりません。',404);
   }
   await db().prepare(`
     WITH RECURSIVE slots(slot) AS (VALUES(0) UNION ALL SELECT slot+1 FROM slots WHERE slot<35)
     INSERT INTO cm_canvas_cells(project_id,slot,task_id)
     SELECT t.project_id,s.slot,t.id FROM studio_tasks t CROSS JOIN slots s
     WHERE t.project_id=? AND t.id=? AND NOT EXISTS (
       SELECT 1 FROM cm_canvas_cells c WHERE c.project_id=t.project_id AND c.slot=s.slot
     )
     ORDER BY s.slot LIMIT 1 ON CONFLICT(task_id) DO NOTHING
   `).bind(projectId,taskId).run();
   if(!await db().prepare('SELECT 1 FROM cm_canvas_cells WHERE project_id=? AND task_id=?').bind(projectId,taskId).first()){
     throw new RequestError('キャンバスに追加できません。空きマスとタスクを確認してください。',409);
   }
   return {ok:true};
 }
 if(action==='task.create'||action==='task.update'){if(b.status!==undefined&&!['todo','in_progress','done'].includes(b.status))throw new RequestError('To Do・Doing・Doneから選んでください。');const result=await studioTaskAction(user,{...b,action,projectId});await cmEvent(projectId,user,b.status==='done'?'task.done':'task.updated',result.id).run();return result;}
 if(action==='project.goal'){await db().prepare("INSERT INTO cm_project_settings(project_id,kind,next_goal)VALUES(?,'web',?) ON CONFLICT(project_id) DO UPDATE SET next_goal=excluded.next_goal").bind(projectId,shortText(b.goal,300,false)).run();return {ok:true};}
 if(['member.remove','invite.create','invite.revoke'].includes(action)&&!recentlyVerified(user))throw new RequestError('参加権限の操作は、再ログインから5分以内に行ってください。',403);
 if(action==='member.remove'){
 if(!user.isStudioAdmin&&p.created_by!==user.accountId)throw new RequestError('プロジェクト作成者が参加を解除できます。',403);
 const id=shortText(b.accountId,100);if(id===user.accountId||id===p.created_by)throw new RequestError('作成者自身は解除できません。');
 await db().batch([db().prepare('DELETE FROM cm_roles WHERE project_id=? AND account_id=?').bind(projectId,id),db().prepare('DELETE FROM studio_project_members WHERE project_id=? AND account_id=?').bind(projectId,id),db().prepare('UPDATE studio_projects SET revision=revision+1 WHERE id=?').bind(projectId)]);return {ok:true};
 }
 if(action==='invite.create'||action==='invite.revoke'){
 if(!user.isStudioAdmin&&p.created_by!==user.accountId)throw new RequestError('プロジェクト作成者が招待できます。',403);
 if(action==='invite.revoke'){await db().prepare('UPDATE cm_invites SET revoked_at=? WHERE id=? AND project_id=? AND used_at IS NULL').bind(Date.now(),shortText(b.inviteId,100),projectId).run();return {ok:true};}
 if(!['tester','creator'].includes(b.role))throw new RequestError('招待の役割を選んでください。');const token=crypto.randomUUID()+crypto.randomUUID(),id=crypto.randomUUID(),expires=Date.now()+7*86400000;await db().prepare('INSERT INTO cm_invites(id,project_id,token_hash,role,created_by,expires_at)VALUES(?,?,?,?,?,?)').bind(id,projectId,await digest(token),b.role,user.accountId,expires).run();return {ok:true,id,url:origin+'/codemate/join#invite='+token,expiresAt:expires};
 }
 if(action==='build.create'){
 const title=shortText(b.title,120),label=shortText(b.versionLabel,40),summary=shortText(b.summary||'',2000,false),kind=p.kind||'web',url=previewUrl(b.previewUrl,origin),commit=commitUrl(b.commitUrl),key=clientKey(b.clientId);
 const platform=b.platform==='game'&&kind==='web'?'game':kind;
 const device=kind==='ios'?shortText(b.device||'',80,false)||null:null;
 const recording=kind==='ios'?previewUrl(b.recordingUrl,origin):null;
 if(recording&&!/\.(mp4|webm)$/i.test(new URL(recording).pathname)){
   throw new RequestError('MP4またはWebMファイルのURLを入力してください。');
 }
 if(kind==='web'&&!url)throw new RequestError('試せるWebプレビューURLを登録してください。');if(kind==='ios'&&url)throw new RequestError('iOS版は画像を共有できます。Simulator実行はMac版で対応予定です。');
 const task=b.taskId?shortText(b.taskId,100):null,previous=b.previousId?await build(projectId,shortText(b.previousId,100)):null,asset=b.assetId?shortText(b.assetId,100):null;
 if(task&&!await db().prepare('SELECT 1 FROM studio_tasks WHERE id=? AND project_id=?').bind(task,projectId).first())throw new RequestError('制作目標を確認してください。');
 if(asset&&!await db().prepare('SELECT 1 FROM cm_assets WHERE id=? AND project_id=? AND uploaded_by=?').bind(asset,projectId,user.accountId).first())throw new RequestError('アップロードした画像を選んでください。');
 if(kind==='ios'&&!asset&&!recording)throw new RequestError('スクリーンショットまたは録画URLを登録してください。');
 const old=await db().prepare('SELECT b.*,d.platform,d.device,d.recording_url FROM cm_builds b LEFT JOIN cm_preview_details d ON d.build_id=b.id WHERE b.created_by=? AND b.client_id=?').bind(user.accountId,key).first<any>();if(old){if((old.platform||old.kind)!==platform||old.device!==device||old.recording_url!==recording||old.project_id!==projectId||old.version_label!==label||old.title!==title||old.preview_url!==url||old.commit_url!==commit||old.after_asset_id!==asset||old.summary!==summary||old.task_id!==task||old.previous_id!==(previous?.id||null))throw new RequestError('送信IDを確認してください。',409);return {ok:true,id:old.id};}
 const id=crypto.randomUUID(),at=now();await db().batch([db().prepare('INSERT INTO cm_builds(id,project_id,task_id,title,version_label,summary,kind,preview_url,commit_url,previous_id,after_asset_id,created_by,client_id,created_at)VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(created_by,client_id) DO NOTHING').bind(id,projectId,task,title,label,summary,kind,url,commit,previous?.id||null,asset,user.accountId,key,at),db().prepare('INSERT INTO cm_preview_details(build_id,platform,device,recording_url) SELECT id,?,?,? FROM cm_builds WHERE id=?').bind(platform,device,recording,id),db().prepare("INSERT INTO cm_events(project_id,actor_id,kind,target_id,build_id,created_at) SELECT ?,?,'build.shared',?,?,? WHERE EXISTS(SELECT 1 FROM cm_builds WHERE id=?)").bind(projectId,user.accountId,id,id,at,id)]);
 const saved=await db().prepare('SELECT id,project_id,version_label FROM cm_builds WHERE created_by=? AND client_id=?').bind(user.accountId,key).first<any>();if(saved.project_id!==projectId||saved.version_label!==label)throw new RequestError('送信IDを確認してください。',409);return {ok:true,id:saved.id};
 }
 if(action==='feedback.task'){
 const f=await feedback(user,shortText(b.feedbackId,100));if(f.project_id!==projectId)throw new RequestError('感想が見つかりません。',404);
 const taskId='cm-feedback-'+f.id,at=now();await db().batch([
 db().prepare("INSERT INTO studio_tasks(id,project_id,title,description,status,priority,assignee_ids,mutation_id,client_id,created_by,updated_by,created_at,updated_at)VALUES(?,?,?,?,'todo','medium',?,?,?,?,?,?,?) ON CONFLICT DO NOTHING").bind(taskId,projectId,'改善: '+f.body.slice(0,100),f.body,JSON.stringify([user.accountId]),crypto.randomUUID(),taskId,user.accountId,user.accountId,at,at),
 db().prepare('INSERT INTO cm_journeys(feedback_id,task_id,created_by,created_at)VALUES(?,?,?,?) ON CONFLICT(feedback_id) DO NOTHING').bind(f.id,taskId,user.accountId,at),
 db().prepare("INSERT INTO cm_events(project_id,actor_id,kind,target_id,build_id,created_at) SELECT ?,?,'feedback.task',?,?,? WHERE changes()>0").bind(projectId,user.accountId,f.id,f.build_id,at)]);return {ok:true,taskId};
 }
 if(action==='retest.request'){
 const f=await feedback(user,shortText(b.feedbackId,100));if(f.project_id!==projectId)throw new RequestError('感想が見つかりません。',404);
 const improved=await build(projectId,shortText(b.buildId,100)),original=await build(projectId,f.build_id);
 if(improved.seq<=original.seq)throw new RequestError('新しい改善バージョンを選んでください。');
 const j=await db().prepare('SELECT task_id FROM cm_journeys WHERE feedback_id=?').bind(f.id).first<any>();if(!j)throw new RequestError('先に感想を改善タスクにしてください。');
 if(improved.task_id!==j.task_id)throw new RequestError('改善タスクを関連付けた作品バージョンを選んでください。');
 const people=await codematePeople(projectId);if(!people.some((a:any)=>a.id===f.author_id))throw new RequestError('感想の投稿者は現在このプロジェクトに参加していません。',409);
 const id=crypto.randomUUID(),at=now();await db().batch([db().prepare('INSERT INTO cm_retests(id,feedback_id,build_id,requested_by,tester_id,created_at)VALUES(?,?,?,?,?,?) ON CONFLICT(feedback_id,build_id) DO NOTHING').bind(id,f.id,improved.id,user.accountId,f.author_id,at),db().prepare("INSERT INTO cm_events(project_id,actor_id,kind,target_id,build_id,created_at) SELECT ?,?,'retest.requested',?,?,? WHERE EXISTS(SELECT 1 FROM cm_retests WHERE id=?)").bind(projectId,user.accountId,f.id,improved.id,at,id)]);return {ok:true};
 }
 throw new RequestError('操作を確認してください。');
}
