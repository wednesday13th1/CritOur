import {env} from 'cloudflare:workers';
import {studioActor,type StudioActor,activeStudioAccount} from './studio-access';
import {RequestError} from './request-security';
export function codemateEnabled(){if(env.CODEMATE_ENABLED!=='true')throw new RequestError('CodeMateはまだ公開されていません。',404)}
export async function codemateActor(){codemateEnabled();return studioActor()}
export async function codemateProject(user:StudioActor,id:string,write=false){
 if(!id||id.length>100)throw new RequestError('プロジェクトが見つかりません。',404);
 const p=await env.DB!.prepare(`SELECT p.*,s.kind,s.next_goal,r.role,EXISTS(SELECT 1 FROM studio_project_members m WHERE m.project_id=p.id AND m.account_id=?) AS member FROM studio_projects p LEFT JOIN cm_project_settings s ON s.project_id=p.id LEFT JOIN cm_roles r ON r.project_id=p.id AND r.account_id=? WHERE p.id=?`).bind(user.accountId,user.accountId,id).first<any>();
 if(!p||!user.isStudioAdmin&&(p.archived_at||!p.member&&!p.role))throw new RequestError('プロジェクトが見つかりません。',404);
 p.role=user.isStudioAdmin?'manager':p.role||'creator';
 if(write&&(p.role==='tester'||p.archived_at))throw new RequestError(p.archived_at?'アーカイブ済みです。':'テスターは作品の確認と感想を送れます。',403);
 return p;
}
export async function codemateProjects(user:StudioActor){return (await env.DB!.prepare(`SELECT p.id,p.name,p.description,p.archived_at,s.kind,s.next_goal,r.role FROM studio_projects p LEFT JOIN cm_project_settings s ON s.project_id=p.id LEFT JOIN cm_roles r ON r.project_id=p.id AND r.account_id=? WHERE p.archived_at IS NULL AND (?=1 OR r.account_id IS NOT NULL OR EXISTS(SELECT 1 FROM studio_project_members m WHERE m.project_id=p.id AND m.account_id=?)) ORDER BY p.updated_at DESC,p.id`).bind(user.accountId,user.isStudioAdmin?1:0,user.accountId).all<any>()).results}
export async function codematePeople(project:string){return(await env.DB!.prepare(`SELECT a.id,a.display_name,COALESCE(r.role,'creator') AS role FROM member_accounts a LEFT JOIN allowed_emails e ON e.email=a.email AND e.public_member_id=a.public_member_id AND e.disabled_at IS NULL LEFT JOIN cm_roles r ON r.account_id=a.id AND r.project_id=? WHERE ${activeStudioAccount} AND (r.account_id IS NOT NULL OR EXISTS(SELECT 1 FROM studio_project_members m WHERE m.project_id=? AND m.account_id=a.id) OR EXISTS(SELECT 1 FROM studio_admins x WHERE x.account_id=a.id AND x.auth_user_id=a.auth_user_id)) ORDER BY a.display_name,a.id`).bind(project,project).all()).results}
export function cmEvent(project:string,user:StudioActor,kind:string,target:string,build:string|null=null){return env.DB!.prepare('INSERT INTO cm_events(project_id,actor_id,kind,target_id,build_id,created_at)VALUES(?,?,?,?,?,?)').bind(project,user.accountId,kind,target,build,new Date().toISOString())}
