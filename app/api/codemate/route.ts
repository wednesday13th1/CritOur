import {codemateActor} from '@/lib/codemate-access';
import {cmAction,cmRead} from '@/lib/codemate-service';
import {sameOrigin,rateLimit} from '@/lib/admin-auth';
import {readJson} from '@/lib/request-security';
import {studioJson,studioError} from '@/lib/studio-response';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{const user=await codemateActor();return studioJson(await cmRead(user,new URL(req.url).searchParams))}catch(e){return studioError(e)}}
export async function POST(req:Request){if(!sameOrigin(req))return studioJson({error:'Invalid origin'},403);try{const user=await codemateActor();await rateLimit('codemate:'+user.accountId,90,60000);return studioJson(await cmAction(user,await readJson(req,16384),new URL(req.url).origin))}catch(e){return studioError(e)}}
