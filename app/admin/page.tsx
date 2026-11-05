import {siteAdminUser} from '@/lib/site-access';
import {redirect} from 'next/navigation';

export const dynamic='force-dynamic';
export default async function Admin(){redirect(await siteAdminUser()?'/admin/dashboard':'/admin/login');}
