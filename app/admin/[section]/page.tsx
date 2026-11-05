import {env} from 'cloudflare:workers';
import {siteAdminUser} from '@/lib/site-access';
import {redirect,notFound} from 'next/navigation';
import {getAdminUser} from '@/lib/admin-auth';
import {getCmsData} from '@/lib/cms';
import {AdminApp} from '@/components/admin-app';
export const dynamic='force-dynamic';
export default async function Workspace({params}:{params:Promise<{section:string}>}) {
 const user=await siteAdminUser();if(!user){if(await getAdminUser())redirect('/codemate');redirect('/admin/login');}
 let {section}=await params;if(env.CODEMATE_ENABLED==='true'&&['chat','messages','calendar'].includes(section))redirect('/codemate/'+(section==='calendar'?'projects':'chat')); if(section==='appearance')section='about';if(!['dashboard','chat','messages','projects','news','members','about','settings','activity','calendar'].includes(section))notFound();
 return <AdminApp initial={await getCmsData(true)} user={user} logout="/api/admin/logout" initialView={section as any} codemate={env.CODEMATE_ENABLED==='true'}/>;
}
