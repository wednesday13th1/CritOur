import {showcaseMedia,type MediaRow} from './critour-showcase-media';
import type {HelpRequest} from './critour-types';
import {env} from 'cloudflare:workers';
import type {StudioActor} from './studio-access';
import {RequestError} from './request-security';
import {shortText} from './codemate-policy';
import {visibleListing} from './codemate-showcase';
type PublicProject=MediaRow&{project_id:string;category:string;stage:string;kind:string;listing_id:string;title:string;description:string;seeking:number;preview_url:string|null;after_asset_id:string|null;creator_label:string;token:string};
type PublicImpact={token:string;project_token:string;contribution_id:string;feedback:string;improvement:string;before_text:string;task_title:string;project_title:string;listing_id:string;contributor:string};
const db=()=>env.DB!;
export const validToken=(token:string)=>/^[a-f0-9-]{36}$/.test(token);
export async function publicProject(token:string){
 if(!validToken(token)||env.CODEMATE_ENABLED!=='true')throw new RequestError("作品が見つかりません。",404);
 const p=await db().prepare(`SELECT s.id AS listing_id,s.title,s.description,s.seeking,b.preview_url,b.after_asset_id,
 u.creator_label,u.token,s.project_id,s.category,s.stage,b.kind,m.listing_id AS media_listing_id,m.cover_id,m.screenshots,m.demo_url,m.video_url,m.github_url FROM cr_publications u JOIN cm_showcase s ON s.id=u.listing_id
 JOIN studio_projects p ON p.id=s.project_id JOIN cm_builds b ON b.id=s.build_id AND b.project_id=p.id LEFT JOIN cr_showcase_media m ON m.listing_id=s.id
 WHERE u.token=? AND u.published=1 AND s.visible=1 AND s.hidden=0 AND p.archived_at IS NULL AND u.confirmed_by=p.created_by`).bind(token).first<PublicProject>();
 if(!p)throw new RequestError("作品が見つかりません。",404);
 const requests=await db().prepare(`SELECT r.id,r.title,r.instructions,r.kind,r.minutes,r.difficulty,r.no_code,'open' AS status,COALESCE(d.required_skills,'') AS required_skills,
 CASE WHEN EXISTS(SELECT 1 FROM cr_contributions c WHERE c.request_id=r.id AND c.status!='implemented' AND COALESCE(c.decision,'')!='declined') THEN 'in_progress' ELSE 'open' END AS progress
 FROM cr_requests r LEFT JOIN cr_request_details d ON d.request_id=r.id WHERE r.listing_id=? AND r.status='open' ORDER BY r.difficulty!='beginner',r.created_at DESC LIMIT 100`).bind(p.listing_id).all<HelpRequest>();
 const impacts=await db().prepare(`SELECT u.token,c.id AS contribution_id,c.updated_at AS at,r.status AS task_status,r.id AS request_id,r.updated_at AS completed_at
 FROM cr_impact_publications u JOIN cr_contributions c ON c.id=u.contribution_id JOIN cr_requests r ON r.id=c.request_id
 JOIN cm_showcase s ON s.id=r.listing_id JOIN studio_projects p ON p.id=s.project_id
 WHERE s.id=? AND u.published=1 AND u.confirmed_by=p.created_by AND c.status='implemented' AND c.decision='accepted'
 AND length(trim(c.improvement))>0 AND NOT EXISTS(SELECT 1 FROM cr_feedback_links f WHERE f.contribution_id=c.id)
 AND EXISTS(SELECT 1 FROM cr_history h WHERE h.contribution_id=c.id AND h.status='implemented' AND h.actor_id=p.created_by AND h.version=c.version)
 ORDER BY u.confirmed_at DESC LIMIT 20`).bind(p.listing_id).all<{token:string;contribution_id:string;at:string;task_status:string;request_id:string;completed_at:string}>();
 return {...p,media:showcaseMedia(p),requests:requests.results,impacts:impacts.results};
}
export async function publicImpact(token:string){
 if(!validToken(token)||env.CODEMATE_ENABLED!=='true')throw new RequestError("改善内容が見つかりません。",404);
 const row=await db().prepare(`SELECT i.token,u.token AS project_token,c.id AS contribution_id,c.body AS feedback,c.improvement,r.instructions AS before_text,r.title AS task_title,
 s.title AS project_title,s.id AS listing_id,CASE WHEN f.show_name=1 THEN f.public_label ELSE 'A CritOur collaborator' END AS contributor
 FROM cr_impact_publications i JOIN cr_contributions c ON c.id=i.contribution_id JOIN cr_requests r ON r.id=c.request_id
 JOIN cm_showcase s ON s.id=r.listing_id JOIN studio_projects p ON p.id=s.project_id
 JOIN cr_publications u ON u.listing_id=s.id LEFT JOIN cr_public_profiles f ON f.account_id=c.author_id
 WHERE i.token=? AND i.published=1 AND c.status='implemented' AND c.decision='accepted' AND length(trim(c.improvement))>0
 AND NOT EXISTS(SELECT 1 FROM cr_feedback_links f WHERE f.contribution_id=c.id) AND i.confirmed_by=p.created_by AND u.confirmed_by=p.created_by AND u.published=1 AND s.visible=1 AND s.hidden=0 AND p.archived_at IS NULL
 AND EXISTS(SELECT 1 FROM cr_history h WHERE h.contribution_id=c.id AND h.status='implemented' AND h.actor_id=p.created_by AND h.version=c.version)`).bind(token).first<PublicImpact>();
 if(!row)throw new RequestError("改善内容が見つかりません。",404);return row;
}
export async function publicAction(user:StudioActor,b:Record<string,unknown>){
 const at=new Date().toISOString();
 if(b.action==='profile.visibility'){
  const label=shortText(b.label||'',80,b.showName===true);if(b.showName!==true&&b.showName!==false)throw new RequestError("名前を公開するか選んでください。");
  await db().prepare('INSERT INTO cr_public_profiles(account_id,public_label,show_name,updated_at)VALUES(?,?,?,?) ON CONFLICT(account_id) DO UPDATE SET public_label=excluded.public_label,show_name=excluded.show_name,updated_at=excluded.updated_at').bind(user.accountId,label,b.showName?1:0,at).run();return {ok:true};
 }
 const listing=shortText(b.listingId,100),s=await visibleListing(user,listing);
 if(s.project_owner!==user.accountId)throw new RequestError("公開できるのは作品の管理者だけです。",403);
 if(b.published!==true&&b.published!==false)throw new RequestError("公開するか選んでください。");
 if(b.published&&b.confirm!==true)throw new RequestError("公開する内容を確認し、同意してください。");
 if(b.action==='publication.save'){
  const label=shortText(b.creatorLabel||"CritOurの作者",80);
  await db().prepare(`INSERT INTO cr_publications(token,listing_id,creator_label,published,confirmed_by,confirmed_at)VALUES(?,?,?,?,?,?) ON CONFLICT(listing_id) DO UPDATE SET creator_label=excluded.creator_label,published=excluded.published,confirmed_by=excluded.confirmed_by,confirmed_at=excluded.confirmed_at`).bind(crypto.randomUUID(),listing,label,b.published?1:0,user.accountId,at).run();
  const row=await db().prepare('SELECT token FROM cr_publications WHERE listing_id=?').bind(listing).first<{token:string}>();return {ok:true,path:'/p/'+row.token};
 }
 if(b.action==='impact.publish'){
  const c=await db().prepare(`SELECT c.id FROM cr_contributions c JOIN cr_requests r ON r.id=c.request_id WHERE c.id=? AND r.listing_id=? AND c.status='implemented' AND c.decision='accepted' AND length(trim(c.improvement))>0 AND NOT EXISTS(SELECT 1 FROM cr_feedback_links f WHERE f.contribution_id=c.id) AND EXISTS(SELECT 1 FROM cr_history h WHERE h.contribution_id=c.id AND h.status='implemented' AND h.actor_id=? AND h.version=c.version)`).bind(shortText(b.contributionId,100),listing,user.accountId).first<{id:string}>();
  if(!c)throw new RequestError("確認済みで作品に反映された貢献を選んでください。以前のフィードバックを引き継いだ投稿は非公開です。",409);
  const p=await db().prepare('SELECT token FROM cr_publications WHERE listing_id=? AND published=1').bind(listing).first<{token:string}>();if(!p)throw new RequestError("先に作品ページを公開してください。",409);
  await db().prepare('INSERT INTO cr_impact_publications(token,contribution_id,published,confirmed_by,confirmed_at)VALUES(?,?,?,?,?) ON CONFLICT(contribution_id) DO UPDATE SET published=excluded.published,confirmed_by=excluded.confirmed_by,confirmed_at=excluded.confirmed_at').bind(crypto.randomUUID(),c.id,b.published?1:0,user.accountId,at).run();
  const row=await db().prepare('SELECT token FROM cr_impact_publications WHERE contribution_id=?').bind(c.id).first<{token:string}>();return {ok:true,path:'/impact/'+row.token};
 }
 throw new RequestError("公開設定の操作を確認してください。");
}
