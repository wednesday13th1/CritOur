import {env} from 'cloudflare:workers';
export async function audit(action:string,resource:string,actor?:{accountId:string;displayName:string}) {
 await env.DB!.prepare('INSERT INTO audit_logs (id,actor_id,actor_name,action,resource,created_at) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),actor?.accountId||null,actor?.displayName||null,action,resource,new Date().toISOString()).run();
}
