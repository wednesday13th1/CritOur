import {redirect,notFound} from 'next/navigation';
import {codemateActor} from '@/lib/codemate-access';
import {cmRead} from '@/lib/codemate-service';
import {RequestError} from '@/lib/request-security';
import {CodeMate,CodeMateJoinLogin} from '@/components/codemate';
import '../codemate.css';
export const dynamic='force-dynamic';
export const metadata={title:'CodeMate — Make something. Make it better. Together.'};
export default async function Page({params}:{params:Promise<{section?:string[]}>}){const parts=(await params).section||[];if(parts.length>1||!['','projects','playground','chat','join','discover'].includes(parts[0]||''))notFound();try{const user=await codemateActor();return <CodeMate initial={await cmRead(user,new URLSearchParams())} view={parts[0]||'home'}/>}catch(e){if(e instanceof RequestError&&e.status===401){if(parts[0]==='join')return <CodeMateJoinLogin/>;redirect('/codemate/login');}if(e instanceof RequestError&&e.status===404)notFound();throw e}}
