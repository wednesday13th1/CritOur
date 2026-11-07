import {redirect,notFound} from 'next/navigation';
import {codemateActor} from '@/lib/codemate-access';
import {cmRead} from '@/lib/codemate-service';
import {RequestError} from '@/lib/request-security';
import {CritOur,CritOurJoinLogin} from '@/components/codemate';
import '../codemate.css';
export const dynamic='force-dynamic';
export const metadata={title:"CritOur — ひとりで作り、みんなで育てる。"};
export default async function Page({params}:{params:Promise<{section?:string[]}>}){
 const parts=(await params).section||[];
 if(parts.length>1||!['','projects','playground','chat','join','discover','create','profile'].includes(parts[0]||''))notFound();
 let initial:Awaited<ReturnType<typeof cmRead>>,joinLogin=false;
 try{const user=await codemateActor();initial=await cmRead(user,new URLSearchParams());}
 catch(e){
  if(e instanceof RequestError&&e.status===401){if(parts[0]==='join')joinLogin=true;else redirect('/codemate/login?returnTo='+encodeURIComponent(parts[0]?'/codemate/'+parts[0]:'/codemate'));}
  else if(e instanceof RequestError&&e.status===404)notFound();
  else throw e;
 }
 if(joinLogin)return <CritOurJoinLogin/>;
 return <CritOur initial={initial} view={parts[0]||'home'}/>;
}
