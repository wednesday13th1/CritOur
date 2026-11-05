import {env} from 'cloudflare:workers';
import {studioActor,studioAdmin,activeStudioAccount} from '@/lib/studio-access';
import {studioJson,studioError} from '@/lib/studio-response';
export const dynamic='force-dynamic';
export async function GET(){try{const user=await studioActor();studioAdmin(user);const rows=await env.DB!.prepare(`SELECT a.id,a.display_name,a.avatar_url FROM member_accounts a LEFT JOIN allowed_emails e ON e.email=a.email AND e.public_member_id=a.public_member_id AND e.disabled_at IS NULL WHERE ${activeStudioAccount} ORDER BY a.display_name,a.id`).all();return studioJson({accounts:rows.results})}catch(e){return studioError(e)}}
