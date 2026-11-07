import {redirect,notFound} from 'next/navigation';
import {env} from 'cloudflare:workers';
import {getAdminUser} from '@/lib/admin-auth';
import {CritourLogin} from '@/components/critour-login';
import {oauthReady} from '@/lib/critour-oauth';
import {safeReturn} from '@/lib/critour-oauth-policy';
import '../codemate.css';
export const dynamic='force-dynamic';
export const metadata={title:"CritOurにログイン"};
export default async function Login({searchParams}:{searchParams:Promise<{returnTo?:string;error?:string}>}){const params=await searchParams,destination=safeReturn(params.returnTo);if(env.CODEMATE_ENABLED!=='true')notFound();if(!params.error&&await getAdminUser())redirect(destination);return <CritourLogin returnTo={destination} error={params.error} ready={{google:oauthReady('google'),github:oauthReady('github')}}/>}
