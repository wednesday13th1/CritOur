import {env} from 'cloudflare:workers';
import {RequestError} from './request-security';
import {publicProject,publicImpact} from './critour-public';
import {visibleListing} from './codemate-showcase';
import type {StudioActor} from './studio-access';
const db=()=>env.DB!;
const allowed=['project_viewed','share_clicked','collaboration_started','impact_viewed'];
export function analyticsIdentity(value:unknown){const v=value as Record<string,unknown>;return v&&typeof v.visitor==='string'&&/^[a-f0-9-]{36}$/.test(v.visitor)&&typeof v.source==='string'&&['direct','share'].includes(v.source)?{visitor:v.visitor,source:v.source}:null;}
export function analyticsWrite(event:string,listing:string,eventId:string,context:unknown,contribution?:{id:string;mutation:string}){
 const a=analyticsIdentity(context);if(!a)return null;
 return db().prepare(`INSERT OR IGNORE INTO cr_analytics(event_id,event,visitor,listing_id,source,occurred_at) SELECT ?,?,?,?,?,? ${contribution?'WHERE EXISTS(SELECT 1 FROM cr_contributions WHERE id=? AND mutation=?)':''}`).bind(eventId,event,a.visitor,listing,a.source,Date.now(),...(contribution?[contribution.id,contribution.mutation]:[]));
}
export async function recordAnalytics(b:Record<string,unknown>){
 if(!allowed.includes(String(b.event))||typeof b.token!=='string'||(typeof b.eventId!=='string'||!/^[a-f0-9-]{36}$/.test(b.eventId))||!analyticsIdentity(b))throw new RequestError("計測データを確認できませんでした。");
 const row=(b.event==='impact_viewed'||b.event==='share_clicked'&&b.resource==='impact')?await publicImpact(b.token):await publicProject(b.token);
 const write=analyticsWrite(String(b.event),row.listing_id,String(b.eventId),b)!;
 const at=Date.now(),cutoff=at-90*86400000;
 await db().batch([write,db().prepare(`INSERT OR IGNORE INTO cr_analytics(event_id,event,visitor,listing_id,source,occurred_at) SELECT ?,'returning_user',?,?,?,? WHERE EXISTS(SELECT 1 FROM cr_analytics WHERE visitor=? AND listing_id=? AND occurred_at<? AND occurred_at>=?)`).bind(b.eventId+':return',b.visitor,row.listing_id,b.source,at,b.visitor,row.listing_id,at-86400000,cutoff),db().prepare('DELETE FROM cr_analytics WHERE occurred_at<?').bind(cutoff)]);
 return {ok:true};
}
export async function analyticsSummary(user:StudioActor,listing:string){
 const s=await visibleListing(user,listing);if(s.project_owner!==user.accountId)throw new RequestError("利用状況を見られるのは作品の管理者だけです。",403);
 const cutoff=Date.now()-90*86400000;
 const counts=await db().prepare('SELECT event,count(*) AS events,count(DISTINCT visitor) AS browsers FROM cr_analytics WHERE listing_id=? AND occurred_at>=? GROUP BY event').bind(listing,cutoff).all<{event:string;events:number;browsers:number}>();
 const cohort=await db().prepare(`WITH browsers AS (SELECT visitor,min(occurred_at) AS first_at,min(CASE WHEN event='contribution_submitted' THEN occurred_at END) AS contributed_at,max(source='share') AS shared FROM cr_analytics WHERE listing_id=? AND occurred_at>=? GROUP BY visitor)
 SELECT count(*) AS visitors,sum(contributed_at IS NOT NULL) AS contributors,avg(CASE WHEN contributed_at IS NOT NULL THEN (contributed_at-first_at)/1000.0 END) AS seconds_to_first,
 sum(shared=1) AS share_visitors,sum(shared=1 AND contributed_at IS NOT NULL) AS share_contributors,
 sum(first_at<=?) AS eligible7,sum(first_at<=? AND EXISTS(SELECT 1 FROM cr_analytics e WHERE e.listing_id=? AND e.visitor=browsers.visitor AND e.occurred_at>=first_at+7*86400000 AND e.occurred_at<first_at+8*86400000)) AS retained7,
 sum(first_at<=?) AS eligible30,sum(first_at<=? AND EXISTS(SELECT 1 FROM cr_analytics e WHERE e.listing_id=? AND e.visitor=browsers.visitor AND e.occurred_at>=first_at+30*86400000 AND e.occurred_at<first_at+31*86400000)) AS retained30 FROM browsers`).bind(listing,cutoff,Date.now()-8*86400000,Date.now()-8*86400000,listing,Date.now()-31*86400000,Date.now()-31*86400000,listing).first<{visitors:number;contributors:number;seconds_to_first:number;share_visitors:number;share_contributors:number;eligible7:number;retained7:number;eligible30:number;retained30:number}>();
 const useful=await db().prepare(`SELECT count(*) AS total,sum(c.status IN ('adopted','implemented')) AS useful FROM cr_contributions c JOIN cr_requests r ON r.id=c.request_id WHERE r.listing_id=?`).bind(listing).first<{total:number;useful:number}>();
 const projects=await db().prepare(`SELECT count(DISTINCT s.project_id) AS total,sum(has_response) AS useful FROM (SELECT s.project_id,max(EXISTS(SELECT 1 FROM cr_contributions c JOIN cr_requests r ON r.id=c.request_id WHERE r.listing_id=s.id AND c.status IN ('adopted','implemented'))) AS has_response FROM cm_showcase s JOIN studio_projects p ON p.id=s.project_id WHERE p.created_by=? AND p.archived_at IS NULL AND s.visible=1 AND s.hidden=0 GROUP BY s.project_id) s`).bind(user.accountId).first<{total:number;useful:number}>();
 // Suppress small browser cohorts. These are opt-in browser metrics, not user counts.
 return {projectResponse:{publishedProjects:projects.total,projectsWithUsefulResponse:projects.useful||0,rate:projects.total?(projects.useful||0)/projects.total:null},windowDays:90,events:counts.results.filter(r=>r.browsers>=5),cohort:cohort.visitors>=5?cohort:null,usefulResponse:useful.total>=5?{total:useful.total,adopted:useful.useful,rate:useful.useful/useful.total}:null,notice:"計測に同意したブラウザーの集計です。対象が5件未満の場合は表示しません。7日後・30日後に同じブラウザーで再訪したかを集計します。"};
}
