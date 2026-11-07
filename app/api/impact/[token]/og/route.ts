import {publicImpact} from '@/lib/critour-public';
import {cardImage} from '@/lib/critour-og';
import {studioError} from '@/lib/studio-response';
export async function GET(_req:Request,{params}:{params:Promise<{token:string}>}){try{const p=await publicImpact((await params).token);return cardImage(p.project_title,p.improvement,true)}catch(e){return studioError(e)}}
