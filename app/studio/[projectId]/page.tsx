import {redirect,notFound} from 'next/navigation';
import {studioPageData} from '@/lib/studio-page';
import {RequestError} from '@/lib/request-security';
import {StudioShell} from '@/components/studio-shell';
import '../studio.css';
export const dynamic='force-dynamic';
export default async function StudioProject({params}:{params:Promise<{projectId:string}>}){const id=(await params).projectId;try{return <StudioShell key={id} initial={await studioPageData(id)}/>}catch(e){if(e instanceof RequestError&&e.status===401)redirect('/admin/login');if(e instanceof RequestError&&e.status===404)notFound();throw e}}
