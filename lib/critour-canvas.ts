import {env} from 'cloudflare:workers';
import type {CanvasEntry} from './critour-types';

// A completed request counts once for the project and only for accepted contributors on their profile.
export async function contributionCanvas(account: string, listing: string | null, includeOthers = false) {
  const result = await env.DB!.prepare(`
    WITH visible AS (
      SELECT s.id,s.title,s.owner_id,p.created_by FROM cm_showcase s
      JOIN studio_projects p ON p.id=s.project_id
      WHERE s.visible=1 AND s.hidden=0 AND p.archived_at IS NULL
      AND (?1 IS NULL OR s.id=?1)
      AND NOT EXISTS(SELECT 1 FROM cm_showcase_blocks b
        WHERE (b.account_id=?2 AND b.blocked_id=s.owner_id) OR (b.blocked_id=?2 AND b.account_id=s.owner_id))
    ), contributions AS (
      SELECT c.id,c.body,c.decision,c.created_at,c.improvement,
        r.id AS request_id,CASE WHEN r.title='Review existing feedback' AND EXISTS(SELECT 1 FROM cr_feedback_links f WHERE f.contribution_id=c.id)
          THEN '以前のフィードバックを確認' ELSE r.title END AS title,r.status AS task_status,r.updated_at AS task_at,v.title AS project,v.id AS listing_id,v.created_by
      FROM cr_contributions c JOIN cr_requests r ON r.id=c.request_id JOIN visible v ON v.id=r.listing_id
      WHERE (c.author_id=?2 OR (?3=1 AND v.created_by=?2))
      AND NOT EXISTS(SELECT 1 FROM cm_showcase_blocks b
        WHERE (b.account_id=?2 AND b.blocked_id=c.author_id) OR (b.blocked_id=?2 AND b.account_id=c.author_id))
      AND NOT EXISTS(SELECT 1 FROM cr_feedback_links f JOIN cm_showcase_comments sc ON sc.id=f.source_id
        WHERE f.source_kind='showcase' AND f.contribution_id=c.id AND sc.hidden=1)
    ), events AS (
      SELECT 'feedback:'||c.id AS id,'feedback' AS kind,v.title AS title,v.title AS project,v.id AS listing_id,c.created_at AS at,c.body AS detail
      FROM cm_showcase_comments c JOIN visible v ON v.id=c.listing_id
      WHERE c.parent_id IS NULL AND c.hidden=0 AND c.author_id!=v.created_by
      AND (c.author_id=?2 OR (?3=1 AND v.created_by=?2))
      AND NOT EXISTS(SELECT 1 FROM cm_showcase_blocks b
        WHERE (b.account_id=?2 AND b.blocked_id=c.author_id) OR (b.blocked_id=?2 AND b.account_id=c.author_id))
      UNION ALL
      SELECT 'feedback:'||c.id,'feedback',c.title,c.project,c.listing_id,c.created_at,c.body FROM contributions c
      WHERE NOT EXISTS(SELECT 1 FROM cr_feedback_links f WHERE f.contribution_id=c.id)
      UNION ALL
      SELECT h.status||':'||c.id,h.status,c.title,c.project,c.listing_id,h.created_at,CASE WHEN h.status='implemented' THEN c.improvement END
      FROM contributions c JOIN cr_history h ON h.contribution_id=c.id
      WHERE h.status IN ('adopted','implemented') AND h.actor_id=c.created_by AND c.decision='accepted'
      UNION
      SELECT 'completed:'||c.request_id,'completed',c.title,c.project,c.listing_id,c.task_at,NULL
      FROM contributions c WHERE c.task_status='completed' AND c.decision='accepted'
      AND NOT EXISTS(SELECT 1 FROM cr_feedback_links f WHERE f.contribution_id=c.id)
    )
    SELECT * FROM events ORDER BY at DESC,id LIMIT 48`).bind(listing,account,includeOthers?1:0).all<CanvasEntry>();
  return result.results;
}
