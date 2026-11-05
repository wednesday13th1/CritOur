import {env} from 'cloudflare:workers';
import {studioActor,studioProjectList,studioProjectDetails,activeStudioAccount} from '@/lib/studio-access';
import {studioSummary} from '@/lib/studio-response';
export async function studioPageData(projectId?:string){
 const actor=await studioActor();
 const [projects,detail,accounts,cmsProjects]=await Promise.all([
 studioProjectList(actor),projectId?studioProjectDetails(actor,projectId):null,
 actor.isStudioAdmin?env.DB!.prepare(`SELECT a.id,a.display_name,a.avatar_url FROM member_accounts a LEFT JOIN allowed_emails e ON e.email=a.email AND e.public_member_id=a.public_member_id AND e.disabled_at IS NULL WHERE ${activeStudioAccount} ORDER BY a.display_name,a.id`).all():null,
 actor.isStudioAdmin?env.DB!.prepare('SELECT id,name FROM projects ORDER BY display_order,name').all():null]);
 return {user:studioSummary(actor),projects,detail,accounts:accounts?.results||[],cmsProjects:cmsProjects?.results||[]};
}
