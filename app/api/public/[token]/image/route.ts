import {publicProject} from '@/lib/critour-public';
import {showcaseImage} from '@/lib/critour-showcase-image';
import {studioError} from '@/lib/studio-response';

export async function GET(req:Request,{params}:{params:Promise<{token:string}>}){
  try {
    const project = await publicProject((await params).token);
    return await showcaseImage(project.project_id,[project.media.cover,...project.media.screenshots],new URL(req.url).searchParams.get('asset'));
  } catch(e) { return studioError(e); }
}
