import {redirect,notFound} from 'next/navigation';
import {env} from 'cloudflare:workers';
import {getAdminUser} from '@/lib/admin-auth';
import {CodeLogin} from '@/components/code-login';
export const dynamic='force-dynamic';
export default async function Login(){if(env.CODEMATE_ENABLED!=='true')notFound();if(await getAdminUser())redirect('/codemate');return <CodeLogin destination="/codemate" title="CodeMate"/>}
