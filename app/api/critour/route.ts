import {analyticsSummary} from '@/lib/critour-analytics';
import {publicAction} from '@/lib/critour-public';
import {codemateActor} from '@/lib/codemate-access';
import {collabRead,collabAction} from '@/lib/critour-collaboration';
import {sameOrigin,rateLimit} from '@/lib/admin-auth';
import {readJson} from '@/lib/request-security';
import {studioJson,studioError} from '@/lib/studio-response';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{const user=await codemateActor(),q=new URL(req.url).searchParams;return studioJson(q.has('analytics')?await analyticsSummary(user,q.get('analytics')!):await collabRead(user,q))}catch(e){return studioError(e)}}
export async function POST(req:Request){if(!sameOrigin(req))return studioJson({error:'Invalid origin'},403);try{const user=await codemateActor();await rateLimit('critour:'+user.accountId,60,60000);const body=await readJson(req,16384);return studioJson(await (['publication.save','impact.publish','profile.visibility'].includes(body.action)?publicAction(user,body):collabAction(user,body)))}catch(e){return studioError(e)}}
