import {publicProject} from '@/lib/critour-public';
import {cardImage} from '@/lib/critour-og';
import {studioError} from '@/lib/studio-response';
export async function GET(_req:Request,{params}:{params:Promise<{token:string}>}){try{const p=await publicProject((await params).token);return cardImage(p.title,p.description)}catch(e){return studioError(e)}}
