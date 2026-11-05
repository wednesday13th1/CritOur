import {redirect} from 'next/navigation';
import {studioPageData} from '@/lib/studio-page';
import {RequestError} from '@/lib/request-security';
import {StudioShell} from '@/components/studio-shell';
import './studio.css';
export const dynamic='force-dynamic';
export default async function Studio(){try{return <StudioShell key="studio-root" initial={await studioPageData()}/>}catch(e){if(e instanceof RequestError&&e.status===401)redirect('/admin/login');throw e}}
