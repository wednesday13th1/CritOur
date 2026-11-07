import {env} from 'cloudflare:workers';
import {codemateProject} from './codemate-access';
import type {StudioActor} from './studio-access';
import {shortText,feedbackKinds} from './codemate-policy';
import {RequestError} from './request-security';
import {showcaseCategories,showcaseLink,showcaseMedia} from './critour-showcase-media';
const db=()=>env.DB!;
const select=`SELECT s.*,p.created_by AS project_owner,b.kind,b.preview_url,b.version_label,b.after_asset_id,m.listing_id AS media_listing_id,m.cover_id,m.screenshots,m.demo_url,m.video_url,m.github_url,g.tags,g.focus_x,g.focus_y FROM cm_showcase s
 JOIN cm_builds b ON b.id=s.build_id AND b.project_id=s.project_id JOIN studio_projects p ON p.id=s.project_id LEFT JOIN cr_showcase_media m ON m.listing_id=s.id LEFT JOIN cr_showcase_gallery g ON g.listing_id=s.id`;
const blocked=(column:string)=>`NOT EXISTS(SELECT 1 FROM cm_showcase_blocks x WHERE (x.account_id=? AND x.blocked_id=${column}) OR (x.blocked_id=? AND x.account_id=${column}))`;
const fail=()=>new RequestError('展示作品が見つかりません。',404);
const present=(s:any)=>{
 const media=showcaseMedia(s);
 return {id:s.id,title:s.title,description:s.description,category:s.category,stage:s.stage,seeking:!!s.seeking,kind:s.kind,
  version:s.version_label,media,tags:JSON.parse(s.tags||'[]'),focusX:s.focus_x??50,focusY:s.focus_y??50,preview:media.demo,image:!!media.cover,updatedAt:s.updated_at};
};
export async function visibleListing(user:StudioActor,id:string){
 const row=await db().prepare(select+` WHERE s.id=? AND s.visible=1 AND s.hidden=0 AND p.archived_at IS NULL AND ${blocked('s.owner_id')}`).bind(id,user.accountId,user.accountId).first<any>();
 if(!row)throw fail();return row;
}
async function manager(user:StudioActor,project:string){
 const p=await codemateProject(user,project,true);
 if(p.created_by!==user.accountId)throw new RequestError('プロジェクト管理者のみ操作できます。',403);
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
  return {listing:present(row),comments:rows.results.map(({author_id,...c})=>({...c,mine:author_id===user.accountId})),canReview:row.project_owner===user.accountId,canHide:user.isStudioAdmin||row.owner_id===user.accountId};
 }
 const category=(q.get('category')||'').slice(0,40),search=(q.get('q')||'').slice(0,80),mode=q.get('mode');
 const order=mode==='critday'?`(SELECT count(*) FROM cr_requests r WHERE r.listing_id=s.id AND r.status='open' AND r.difficulty='beginner')=0,(SELECT count(*) FROM cm_showcase_comments c WHERE c.listing_id=s.id AND c.hidden=0)+(SELECT count(*) FROM cr_contributions c JOIN cr_requests r ON r.id=c.request_id WHERE r.listing_id=s.id),s.updated_at DESC,s.id`:mode==='new'?'s.rowid DESC':'s.updated_at DESC,s.id';
 const offset=Math.min(2000,Math.max(0,Number.parseInt(q.get('offset')||'0',10)||0));
 const rows=await db().prepare(select+` WHERE s.visible=1 AND s.hidden=0 AND p.archived_at IS NULL AND ${blocked('s.owner_id')}
 AND (?='' OR s.category=? OR CASE s.category WHEN 'app' THEN b.kind WHEN 'learning' THEN 'other' ELSE s.category END=?) AND (?='' OR instr(lower(s.title||' '||s.description),lower(?))>0)
 ${['seeking','critday'].includes(mode||'')?'AND s.seeking=1':''} ORDER BY ${order} LIMIT 25 OFFSET ?`)
 .bind(user.accountId,user.accountId,category,category,category,search,search,offset).all<any>();
 return {listings:rows.results.slice(0,24).map(present),more:rows.results.length>24};
}
export async function showcaseAction(user:StudioActor,b:Record<string,any>){
 const action=b.action, at=new Date().toISOString();
 if(action==='draft'){
  const project=shortText(b.projectId,100);await manager(user,project);
  const title=shortText(b.title,100),description=shortText(b.description,1000),category=shortText(b.category,40);
  if(!Object.hasOwn(showcaseCategories,category)&&!['app','learning'].includes(category)||!['wip','ready'].includes(b.stage))throw new RequestError("カテゴリと制作状況を選んでください。");
  const existing=b.id?await db().prepare(select+' WHERE s.project_id=? AND s.id=?').bind(project,shortText(b.id,100)).first<any>():null;
  if(b.id&&!existing)throw fail();
  const buildId=existing?.build_id||shortText(b.buildId||'',100,false)||'showcase-'+project;
  const build=await db().prepare('SELECT after_asset_id,preview_url FROM cm_builds WHERE id=? AND project_id=?').bind(buildId,project).first<{after_asset_id:string|null;preview_url:string|null}>();
  if(!existing&&b.buildId&&!build)throw fail();
  const defaults=existing?showcaseMedia(existing):{cover:build?.after_asset_id||null,screenshots:[],demo:build?.preview_url||null,video:null,github:null};
  const cover=b.coverId?shortText(b.coverId,100):existing&&b.coverId===null?null:defaults.cover;
  if(b.screenshots!==undefined&&(!Array.isArray(b.screenshots)||b.screenshots.length>6))throw new RequestError("スクリーンショットは6枚まで選べます。");
  const screenshots=[...new Set<string>((b.screenshots??defaults.screenshots).map((value:unknown)=>shortText(value,100)))].filter(id=>id!==cover);
  for(const asset of new Set([cover,...screenshots].filter(Boolean))){
   if(!await db().prepare("SELECT 1 FROM cm_assets WHERE id=? AND project_id=? AND mime IN ('image/png','image/jpeg','image/webp')").bind(asset,project).first())throw new RequestError("このプロジェクトに追加した画像を選んでください。");
  }
  const demo=b.demo===undefined||(!existing&&!b.demo)?defaults.demo:showcaseLink(b.demo,'demo');
  const video=b.video===undefined?defaults.video:showcaseLink(b.video,'video');
  const github=b.github===undefined?defaults.github:showcaseLink(b.github,'github');
  if(b.tags!==undefined&&(!Array.isArray(b.tags)||b.tags.length>8))throw new RequestError('タグは8件まで登録できます。');
  const tags=b.tags===undefined?JSON.parse(existing?.tags||'[]'):[...new Set(b.tags.map((tag:unknown)=>shortText(tag,24)))];
  const position=(value:unknown,fallback:number)=>{
   if(value===undefined)return fallback;
   if(typeof value!=='number'||!Number.isInteger(value)||value<0||value>100)throw new RequestError('画像の位置を0〜100で指定してください。');
   return value;
  };
  const focusX=position(b.focusX,existing?.focus_x??50),focusY=position(b.focusY,existing?.focus_y??50);
  const hasMediaFields=['coverId','screenshots','demo','video','github'].some(key=>Object.hasOwn(b,key));
  const id=existing?.id||crypto.randomUUID();
  await db().batch([
   ...(!existing&&!b.buildId?[db().prepare(`INSERT INTO cm_builds(id,project_id,title,version_label,kind,created_by,client_id,created_at)
    VALUES(?,?,?,?,'web',?,?,?) ON CONFLICT(id) DO NOTHING`).bind(buildId,project,title,'Showcase · '+project,user.accountId,buildId,at)]:[]),
   db().prepare(`INSERT INTO cm_showcase(id,project_id,build_id,owner_id,title,description,category,stage,seeking,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(project_id,build_id) DO UPDATE SET title=excluded.title,description=excluded.description,
    category=excluded.category,stage=excluded.stage,seeking=excluded.seeking,
    visible=CASE WHEN ? THEN cm_showcase.visible ELSE 0 END,updated_at=excluded.updated_at`)
    .bind(id,project,buildId,user.accountId,title,description,category,b.stage,b.seeking===true?1:0,at,existing?1:0),
   ...(hasMediaFields?[db().prepare(`INSERT INTO cr_showcase_media(listing_id,cover_id,screenshots,demo_url,video_url,github_url)
    SELECT id,?,?,?,?,? FROM cm_showcase WHERE project_id=? AND build_id=?
    ON CONFLICT(listing_id) DO UPDATE SET cover_id=excluded.cover_id,screenshots=excluded.screenshots,demo_url=excluded.demo_url,video_url=excluded.video_url,github_url=excluded.github_url`)
    .bind(cover,JSON.stringify(screenshots),demo,video,github,project,buildId)]:[]),
   ...(['tags','focusX','focusY'].some(key=>Object.hasOwn(b,key))?[db().prepare(`INSERT INTO cr_showcase_gallery(listing_id,tags,focus_x,focus_y)
    SELECT id,?,?,? FROM cm_showcase WHERE project_id=? AND build_id=?
    ON CONFLICT(listing_id) DO UPDATE SET tags=excluded.tags,focus_x=excluded.focus_x,focus_y=excluded.focus_y`)
    .bind(JSON.stringify(tags),focusX,focusY,project,buildId)]:[]),
  ]);
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
  const key=typeof b.clientId==='string'?shortText(b.clientId,100):crypto.randomUUID();if(!/^[a-zA-Z0-9_-]{16,100}$/.test(key))throw new RequestError("送信を確認できませんでした。ページを開き直してください。");
  const commentKey=await (await import('./workspace-security')).digest(user.accountId+':'+key);
  const old=await db().prepare('SELECT * FROM cm_showcase_comments WHERE id=?').bind(commentKey).first<{listing_id:string;body:string;kind:string;parent_id:string|null}>();if(old){if(old.listing_id!==id||old.body!==body||old.kind!==b.kind||old.parent_id!==commentId)throw new RequestError("同じ送信がすでに処理されています。ページを更新して確認してください。",409);return {ok:true};}
  if(/(?:https?:\/\/|www\.|[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\d[ -]?){9,})/i.test(body))throw new RequestError('感想にはリンクや連絡先を含めないでください。');
  const result=await db().prepare(`INSERT INTO cm_showcase_comments(id,listing_id,author_id,parent_id,kind,body,created_at)
   SELECT ?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM cm_showcase_comments
     WHERE listing_id=? AND author_id=? AND parent_id IS ? AND lower(trim(body))=lower(?))
   ON CONFLICT(id) DO NOTHING`).bind(commentKey,id,user.accountId,commentId,b.kind,body,at,id,user.accountId,commentId,body).run();
  if(!result.meta.changes){
   const saved=await db().prepare('SELECT 1 FROM cm_showcase_comments WHERE id=? AND listing_id=? AND body=? AND kind=? AND parent_id IS ?').bind(commentKey,id,body,b.kind,commentId).first();
   if(!saved)throw new RequestError("同じ内容のフィードバックはすでに送信されています。",409);
  }
  return {ok:true};
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
