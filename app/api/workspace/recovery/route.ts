import {env} from 'cloudflare:workers';
import {NextResponse} from 'next/server';
import {digest} from '@/lib/workspace-security';
import {recoveryConfig,rotateRecoveredOwner} from '@/lib/owner-recovery';
import {readJson,noStore,RequestError} from '@/lib/request-security';
import {rateLimit} from '@/lib/admin-auth';
const json=(b:unknown,status=200)=>NextResponse.json(b,{status,headers:noStore});
export async function POST(req:Request){
 // No browser-facing recovery, PIN bypass, public email reset or identity reassignment.
 const config=recoveryConfig(env.WORKSPACE_OWNER_RECOVERY);
 if(!config||await digest(req.headers.get('authorization')||'')!==config.authorizationHash)return json({error:'Recovery unavailable'},403);
 try{
  try{await rateLimit('owner-recovery',3,900000)}catch{return json({error:'Recovery rate limit'},429)}
  const body=await readJson(req,4096);if(body.memberId!==config.memberId)return json({error:'Recovery unavailable'},403);
  const token=await rotateRecoveredOwner(env.DB!,config);if(!token)return json({error:'Recovery already consumed or account unavailable'},409);
  return json({token});
 }catch(e){return json({error:e instanceof RequestError?e.message:'Recovery failed'},e instanceof RequestError?e.status:400)}
}
