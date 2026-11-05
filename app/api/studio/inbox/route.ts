import {env} from 'cloudflare:workers';
import {studioActor} from '@/lib/studio-access';
import {studioJson,studioError} from '@/lib/studio-response';
export const dynamic='force-dynamic';
export async function GET(){try{const user=await studioActor();const tasks=await env.DB!.prepare(`SELECT t.id,t.project_id,t.title,t.status,t.priority,t.due_date,p.name AS project_name FROM studio_tasks t JOIN studio_projects p ON p.id=t.project_id WHERE p.archived_at IS NULL AND EXISTS(SELECT 1 FROM json_each(t.assignee_ids) a WHERE a.value=?) AND (?=1 OR EXISTS(SELECT 1 FROM studio_project_members m WHERE m.project_id=p.id AND m.account_id=?)) ORDER BY t.status='done',t.due_date IS NULL,t.due_date,t.updated_at DESC LIMIT 500`).bind(user.accountId,user.isStudioAdmin?1:0,user.accountId).all();return studioJson({tasks:tasks.results});}catch(e){return studioError(e)}}
