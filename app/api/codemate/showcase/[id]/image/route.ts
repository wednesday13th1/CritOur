import {codemateActor} from '@/lib/codemate-access';
import {visibleListing} from '@/lib/codemate-showcase';
import {showcaseMedia} from '@/lib/critour-showcase-media';
import {showcaseImage} from '@/lib/critour-showcase-image';
import {studioError} from '@/lib/studio-response';

export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){
  try {
    const row = await visibleListing(await codemateActor(),(await params).id);
    const media = showcaseMedia(row);
    return await showcaseImage(row.project_id,[media.cover,...media.screenshots],new URL(req.url).searchParams.get('asset'));
  } catch(e) { return studioError(e); }
}
