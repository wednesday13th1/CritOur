import {showcaseCategories} from './critour-showcase-media';
import {env} from 'cloudflare:workers';
export type BuildCard={token:string;title:string;description:string;creator_label:string;image:number;requests:number;beginner:number;minutes:number|null};
export type GalleryCard = BuildCard & {category:string; kind:string; seeking:number; focusX:number; focusY:number};
export async function publicDirectory(q=new URLSearchParams(),accountId=''){
 if(env.CODEMATE_ENABLED!=='true'||!env.DB)return [];
 // An empty installation has no fabricated projects or implied publication grants.
 if(!await env.DB.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='cr_publications'").first())return [];
 const search=(q.get('q')||'').trim().slice(0,80),mode=q.get('mode')||'';
 const category=q.get('category')||'';
 const categoryFilter=Object.hasOwn(showcaseCategories,category)?category:'';
 const beginner=q.get('beginner')==='1'||mode==='beginner';
 const tasks=q.get('tasks')==='1'||mode==='collab';
 const feedback=q.get('feedback')==='1'||mode==='feedback'||mode==='critday';
 const order=mode==='home'?'beginner DESC, requests DESC, s.updated_at DESC':mode==='critday'?`(SELECT count(*) FROM cr_contributions c JOIN cr_requests r ON r.id=c.request_id WHERE r.listing_id=s.id),s.updated_at DESC`:q.get('sort')==='new'?'s.rowid DESC':'s.updated_at DESC';
 const rows=await env.DB.prepare(`SELECT u.token,s.title,s.description,u.creator_label,s.category,b.kind,s.seeking,COALESCE(g.focus_x,50) AS focusX,COALESCE(g.focus_y,50) AS focusY,(CASE WHEN m.listing_id IS NULL THEN b.after_asset_id ELSE m.cover_id END) IS NOT NULL AS image,
 (SELECT count(*) FROM cr_requests r WHERE r.listing_id=s.id AND r.status='open') AS requests,
 (SELECT min(r.minutes) FROM cr_requests r WHERE r.listing_id=s.id AND r.status='open' AND r.difficulty='beginner') AS beginner_minutes,
 (SELECT min(r.minutes) FROM cr_requests r WHERE r.listing_id=s.id AND r.status='open') AS minutes,
 EXISTS(SELECT 1 FROM cr_requests r WHERE r.listing_id=s.id AND r.status='open' AND r.difficulty='beginner') AS beginner
 FROM cr_publications u JOIN cm_showcase s ON s.id=u.listing_id JOIN studio_projects p ON p.id=s.project_id
 JOIN cm_builds b ON b.id=s.build_id AND b.project_id=p.id LEFT JOIN cr_showcase_media m ON m.listing_id=s.id LEFT JOIN cr_showcase_gallery g ON g.listing_id=s.id
 WHERE u.published=1 AND u.confirmed_by=p.created_by AND s.visible=1 AND s.hidden=0 AND p.archived_at IS NULL
 AND (?='' OR instr(lower(s.title||' '||s.description),lower(?))>0 OR EXISTS(SELECT 1 FROM json_each(g.tags) t WHERE instr(lower(t.value),lower(?))>0))
 AND (?='' OR CASE s.category WHEN 'app' THEN b.kind WHEN 'learning' THEN 'other' ELSE s.category END=?)
 AND NOT EXISTS(SELECT 1 FROM cm_showcase_blocks x WHERE (x.account_id=? AND x.blocked_id=p.created_by) OR (x.blocked_id=? AND x.account_id=p.created_by))
 AND (?=0 OR beginner=1) AND (?=0 OR requests>0) AND (?=0 OR s.seeking=1) ORDER BY ${order},s.id LIMIT 24`).bind(search,search,search,categoryFilter,categoryFilter,accountId,accountId,+beginner,+tasks,+feedback).all<GalleryCard & {beginner_minutes:number|null}>();
 return rows.results.map(({beginner_minutes,...project})=>({...project,minutes:beginner_minutes??project.minutes}));
}
