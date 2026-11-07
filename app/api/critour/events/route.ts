import {sameOrigin,rateLimit} from '@/lib/admin-auth';
import {readJson} from '@/lib/request-security';
import {recordAnalytics} from '@/lib/critour-analytics';
import {studioJson,studioError} from '@/lib/studio-response';
export async function POST(req:Request){if(!sameOrigin(req))return studioJson({error:'Invalid origin'},403);try{const b=await readJson(req,2048);await rateLimit('metrics:'+String(b.visitor).slice(0,36),30,60000);return studioJson(await recordAnalytics(b))}catch(e){return studioError(e)}}
