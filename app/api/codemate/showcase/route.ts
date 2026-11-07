import {codemateActor} from '@/lib/codemate-access';
import {showcaseRead,showcaseAction} from '@/lib/codemate-showcase';
import {sameOrigin,rateLimit} from '@/lib/admin-auth';
import {readJson} from '@/lib/request-security';
import {studioJson,studioError} from '@/lib/studio-response';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{return studioJson(await showcaseRead(await codemateActor(),new URL(req.url).searchParams))}catch(e){return studioError(e)}}
export async function POST(req:Request){if(!sameOrigin(req))return studioJson({error:'Invalid origin'},403);try{const u=await codemateActor();await rateLimit('showcase:'+u.accountId,30,60000);return studioJson(await showcaseAction(u,await readJson(req,8192)))}catch(e){return studioError(e)}}
