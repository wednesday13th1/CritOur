import {siteAdminUser} from '@/lib/site-access';
import {redirect} from 'next/navigation';import {getAdminUser} from '@/lib/admin-auth';import {CodeLogin} from '@/components/code-login';export const dynamic='force-dynamic';export default async function Login(){if(await siteAdminUser())redirect('/admin/dashboard');if(await getAdminUser())redirect('/codemate');return <CodeLogin/>;}
