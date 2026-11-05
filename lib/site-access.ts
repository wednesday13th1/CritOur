import {env} from 'cloudflare:workers';
import {getAdminUser} from './admin-auth';
// Rollout is explicitly opt-in; existing production authorization is unchanged.
export async function siteAdminUser(){
 const user=await getAdminUser();if(!user)return null;
 if(env.CODEMATE_ENABLED!=='true')return user;
 return await env.DB!.prepare('SELECT 1 FROM cm_site_admins WHERE account_id=?').bind(user.accountId).first()?user:null;
}
