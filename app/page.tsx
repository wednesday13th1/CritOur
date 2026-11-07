import {env} from 'cloudflare:workers';
import LegacyHome from '@/components/legacy-home';
import {CritourLanding} from '@/components/critour-landing';
import './codemate/codemate.css';
export const dynamic='force-dynamic';
export async function generateMetadata(){return env.CODEMATE_ENABLED==='true'?{title:"CritOur — ひとりで作り、みんなで育てる。",description:"作品を探して、小さな一歩から一緒につくろう。"}:{};}
export default function Home(){return env.CODEMATE_ENABLED==='true'?<CritourLanding/>:<LegacyHome/>;}
