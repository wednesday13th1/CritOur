import {env} from 'cloudflare:workers';
import {codemateProject} from './codemate-access';
import type {StudioActor} from './studio-access';
import {shortText,previewUrl,feedbackKinds} from './codemate-policy';
import {RequestError} from './request-security';
const db=()=>env.DB!;
const select=`SELECT s.*,b.kind,b.preview_url,b.version_label,b.after_asset_id FROM cm_showcase s
 JOIN cm_builds b ON b.id=s.build_id AND b.project_id=s.project_id JOIN studio_projects p ON p.id=s.project_id`;
const blocked=(column:string)=>`NOT EXISTS(SELECT 1 FROM cm_showcase_blocks x WHERE (x.account_id=? AND x.blocked_id=${column}) OR (x.blocked_id=? AND x.account_id=${column}))`;
const fail=()=>new RequestError('展示作品が見つかりません。',404);
const present=(s:any)=>({id:s.id,title:s.title,description:s.description,category:s.category,stage:s.stage,seeking:!!s.seeking,kind:s.kind,version:s.version_label,preview:s.preview_url,image:!!s.after_asset_id,updatedAt:s.updated_at});
export async function visibleListing(user:StudioActor,id:string){
 const row=await db().prepare(select+` WHERE s.id=? AND s.visible=1 AND s.hidden=0 AND p.archived_at IS NULL AND ${blocked('s.owner_id')}`).bind(id,user.accountId,user.accountId).first<any>();
 if(!row)throw fail();return row;
}
async function manager(user:StudioActor,project:string){
 const p=await codemateProject(user,project,true);
 if(!user.isStudioAdmin&&p.created_by!==user.accountId)throw new RequestError('プロジェクト管理者のみ操作できます。',403);
}
export async function showcaseRead(user:StudioActor,q:URLSearchParams){
 const project=q.get('project');
 if(project){
  await manager(user,project);
  const rows=await db().prepare(select+' WHERE s.project_id=? ORDER BY s.updated_at DESC LIMIT 100').bind(project).all<any>();
  return {listings:rows.results.map(s=>({...present(s),buildId:s.build_id,visible:!!s.visible,hidden:!!s.hidden}))};
 }
 if(user.isStudioAdmin&&q.get('reports')==='1'){
  const reports=await db().prepare(`SELECT r.listing_id,r.target_id,r.reason,r.created_at,s.title,s.hidden,
   c.body,c.hidden AS comment_hidden FROM cm_showcase_reports r JOIN cm_showcase s ON s.id=r.listing_id
   LEFT JOIN cm_showcase_comments c ON c.id=r.target_id ORDER BY r.created_at DESC LIMIT 100`).all();
  return {reports:reports.results};
 }
 const id=q.get('id');
 if(id){
  const row=await visibleListing(user,id);
  const rows=await db().prepare(`SELECT c.id,c.parent_id,c.kind,c.body,c.created_at,c.author_id FROM cm_showcase_comments c
   WHERE c.listing_id=? AND c.hidden=0 AND ${blocked('c.author_id')}
   AND (c.parent_id IS NULL OR EXISTS(SELECT 1 FROM cm_showcase_comments a WHERE a.id=c.parent_id AND a.hidden=0 AND ${blocked('a.author_id')}))
   ORDER BY c.created_at,c.id LIMIT 100`).bind(id,user.accountId,user.accountId,user.accountId,user.accountId).all<any>();
  // Opaque IDs for report/block actions only; no account names or profile data.
  return {listing:present(row),comments:rows.results.map(({author_id,...c})=>({...c,mine:author_id===user.accountId})),canHide:user.isStudioAdmin||row.owner_id===user.accountId};
 }
 const category=(q.get('category')||'').slice(0,40),search=(q.get('q')||'').slice(0,80),mode=q.get('mode');
 const order=mode==='new'?'s.rowid DESC':'s.updated_at DESC,s.id';
 const offset=Math.min(2000,Math.max(0,Number.parseInt(q.get('offset')||'0',10)||0));
 const rows=await db().prepare(select+` WHERE s.visible=1 AND s.hidden=0 AND p.archived_at IS NULL AND ${blocked('s.owner_id')}
 AND (?='' OR s.category=?) AND (?='' OR instr(lower(s.title||' '||s.description),lower(?))>0)
 ${mode==='seeking'?'AND s.seeking=1':''} ORDER BY ${order} LIMIT 25 OFFSET ?`)
 .bind(user.accountId,user.accountId,category,category,search,search,offset).all<any>();
 return {listings:rows.results.slice(0,24).map(present),more:rows.results.length>24};
}
export async function showcaseAction(user:StudioActor,b:Record<string,any>,origin:string){
 const action=b.action, at=new Date().toISOString();
 if(action==='draft'){
  const project=shortText(b.projectId,100);await manager(user,project);
  const build=await db().prepare('SELECT id,preview_url,kind,after_asset_id FROM cm_builds WHERE id=? AND project_id=?').bind(shortText(b.buildId,100),project).first<any>();
  if(!build)throw fail();
  if(build.kind==='web'&&!previewUrl(build.preview_url,origin))throw new RequestError('展示できるプレビューURLが必要です。');
  if(build.kind==='ios'&&!build.after_asset_id)throw new RequestError('iOS作品には画像が必要です。');
  const title=shortText(b.title,100),description=shortText(b.description||'',1000,false),category=shortText(b.category,40);
  if(!['app','game','learning','other'].includes(category)||!['wip','ready'].includes(b.stage))throw new RequestError('カテゴリと制作状況を選んでください。');
  const id=crypto.randomUUID();
  await db().prepare(`INSERT INTO cm_showcase(id,project_id,build_id,owner_id,title,description,category,stage,seeking,updated_at)
  VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(project_id,build_id) DO UPDATE SET title=excluded.title,description=excluded.description,
  category=excluded.category,stage=excluded.stage,seeking=excluded.seeking,visible=0,updated_at=excluded.updated_at`)
  .bind(id,project,build.id,user.accountId,title,description,category,b.stage,b.seeking===true?1:0,at).run();
  return {ok:true};
 }
 const id=shortText(b.id,100);
 if(action==='visibility'){
  const row=await db().prepare('SELECT * FROM cm_showcase WHERE id=?').bind(id).first<any>();if(!row)throw fail();
  await manager(user,row.project_id);
  if(b.visible!==true&&b.visible!==false)throw new RequestError('公開範囲を指定してください。');
  if(b.visible&&row.hidden)throw new RequestError('非表示にされた作品です。',403);
  await db().prepare('UPDATE cm_showcase SET visible=?,updated_at=? WHERE id=?').bind(b.visible?1:0,at,id).run();return {ok:true};
 }
 if(action==='moderate'){
  if(!user.isStudioAdmin)throw new RequestError('管理者のみ操作できます。',403);
  await db().prepare('UPDATE cm_showcase SET hidden=1,visible=0 WHERE id=?').bind(id).run();return {ok:true};
 }
 const row=await visibleListing(user,id);
 const commentId=typeof b.commentId==='string'?shortText(b.commentId,100):null;
 const comment=commentId?await db().prepare(`SELECT * FROM cm_showcase_comments c WHERE id=? AND listing_id=? AND hidden=0 AND ${blocked('c.author_id')}`).bind(commentId,id,user.accountId,user.accountId).first<any>():null;
 if(commentId&&!comment)throw fail();
 if(action==='comment'){
  if(!feedbackKinds.includes(b.kind)||comment?.parent_id)throw new RequestError('感想の種類と返信先を確認してください。');
  const body=shortText(b.body,1000);
  if(/(?:https?:\/\/|www\.|[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\d[ -]?){9,})/i.test(body))throw new RequestError('感想にはリンクや連絡先を含めないでください。');
  await db().prepare('INSERT INTO cm_showcase_comments(id,listing_id,author_id,parent_id,kind,body,created_at) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),id,user.accountId,commentId,b.kind,body,at).run();return {ok:true};
 }
 if(action==='hide'&&comment){
  if(!user.isStudioAdmin)await manager(user,row.project_id);
  await db().prepare('UPDATE cm_showcase_comments SET hidden=1 WHERE id=? AND listing_id=?').bind(commentId,id).run();return {ok:true};
 }
 if(action==='report'){
  await db().prepare('INSERT OR IGNORE INTO cm_showcase_reports VALUES(?,?,?,?,?)').bind(user.accountId,id,commentId||id,shortText(b.reason,300),at).run();return {ok:true};
 }
 if(action==='block'){
  const target=comment?.author_id||row.owner_id;if(target===user.accountId)throw new RequestError('自分はブロックできません。');
  await db().prepare('INSERT OR IGNORE INTO cm_showcase_blocks VALUES(?,?)').bind(user.accountId,target).run();return {ok:true};
 }
 throw new RequestError('操作を確認してください。');
}
