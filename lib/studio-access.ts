import {env} from 'cloudflare:workers';
import {getAdminUser} from '@/lib/admin-auth';
import {RequestError} from '@/lib/request-security';
export type StudioActor=NonNullable<Awaited<ReturnType<typeof getAdminUser>>>&{isStudioAdmin:boolean;canInitialize:boolean};
// This is an account identity predicate, never a display-name or public-team label.
export const activeStudioAccount=`a.disabled_at IS NULL AND ((a.auth_user_id LIKE 'google:%' AND e.email IS NOT NULL) OR (a.auth_user_id NOT LIKE 'google:%' AND a.login_code_hash IS NOT NULL))`;
export async function studioActor():Promise<StudioActor>{
 const user=await getAdminUser();if(!user)throw new RequestError('ログインしてください。',401);
 const binding=await env.DB!.prepare('SELECT account_id,auth_user_id FROM studio_admins WHERE id=1').first<{account_id:string;auth_user_id:string}>();
 return {...user,isStudioAdmin:!!binding&&binding.account_id===user.accountId&&binding.auth_user_id===user.userId,canInitialize:!binding&&user.isOwner};
}
export function studioAdmin(user:StudioActor){if(!user.isStudioAdmin)throw new RequestError('Workspace管理者のみ操作できます。',403)}
export async function studioProject(user:StudioActor,id:string){
 if(!id||id.length>100)throw new RequestError('プロジェクトが見つかりません。',404);
 const project=await env.DB!.prepare(`SELECT p.* FROM studio_projects p WHERE p.id=? AND (?=1 OR (p.archived_at IS NULL AND EXISTS(SELECT 1 FROM studio_project_members m WHERE m.project_id=p.id AND m.account_id=?)))`).bind(id,user.isStudioAdmin?1:0,user.accountId).first<any>();
 if(!project)throw new RequestError('プロジェクトが見つかりません。',404);return project;
}
export async function studioProjectList(user:StudioActor){
 return (await env.DB!.prepare(`SELECT p.id,p.name,p.description,p.cms_project_id,p.archived_at,p.created_at,p.updated_at FROM studio_projects p WHERE ?=1 OR (p.archived_at IS NULL AND EXISTS(SELECT 1 FROM studio_project_members m WHERE m.project_id=p.id AND m.account_id=?)) ORDER BY p.archived_at IS NOT NULL,p.updated_at DESC,p.id`).bind(user.isStudioAdmin?1:0,user.accountId).all()).results;
}
export async function studioProjectDetails(user:StudioActor,id:string){
 const project=await studioProject(user,id);
 const [members,activity]=await Promise.all([
 env.DB!.prepare(`SELECT a.id,a.display_name,a.avatar_url FROM studio_project_members m JOIN member_accounts a ON a.id=m.account_id LEFT JOIN allowed_emails e ON e.email=a.email AND e.public_member_id=a.public_member_id AND e.disabled_at IS NULL WHERE m.project_id=? AND ${activeStudioAccount} ORDER BY a.display_name,a.id`).bind(id).all(),
 env.DB!.prepare('SELECT s.id,s.action,s.target_account_id,s.created_at,a.display_name AS actor_name FROM studio_activity s JOIN member_accounts a ON a.id=s.actor_id WHERE s.project_id=? ORDER BY s.created_at DESC,s.id DESC LIMIT 20').bind(id).all()]);
 return {project,members:members.results,activity:activity.results};
}
export function studioLog(projectId:string|null,user:StudioActor,action:string,target:string|null=null){return env.DB!.prepare('INSERT INTO studio_activity(id,project_id,actor_id,action,target_account_id,created_at)VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),projectId,user.accountId,action,target,new Date().toISOString())}
