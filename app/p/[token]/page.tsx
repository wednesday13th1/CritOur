import {ja} from '@/lib/critour-ja';
import {CreativeCanvas} from '@/components/critour-canvas';
import {ShowcaseGallery,ShowcaseDetails} from '@/components/critour-showcase-detail';
import {contributionCanvas} from '@/lib/critour-canvas';
import type {CanvasEntry} from '@/lib/critour-types';
import {PublicHeader} from '@/components/critour-public-ui';
import {env} from 'cloudflare:workers';
import {notFound} from 'next/navigation';
import {headers} from 'next/headers';
import {publicProject} from '@/lib/critour-public';
import {getAdminUser} from '@/lib/admin-auth';
import {ShareButtons,PublicContribution,MeasurementChoice} from '@/components/critour-share';
import {RequestError} from '@/lib/request-security';
import '../../codemate/codemate.css';
export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{token:string}>}){try{const p=await publicProject((await params).token),h=await headers(),origin=env.PUBLIC_BASE_URL||env.AUTH_BASE_URL||('https://'+h.get('host'));return {title:p.title+' · CritOur',description:p.description,robots:{index:false,follow:false},openGraph:{title:p.title,description:"あなたのアイデアで、この作品を育てませんか？ "+p.description,type:'website',url:origin+'/p/'+p.token,images:[{url:origin+'/api/public/'+p.token+'/og',width:1200,height:630}]},twitter:{card:'summary_large_image',images:[origin+'/api/public/'+p.token+'/og']}}}catch{return {title:"作品を表示できません・CritOur",robots:{index:false,follow:false}}}}
export default async function Page({params}:{params:Promise<{token:string}>}){
 let p;try{p=await publicProject((await params).token)}catch(e){if(e instanceof RequestError&&e.status===404)notFound();throw e;}
 const user=await getAdminUser();
 const mine=user?await contributionCanvas(user.accountId,p.listing_id):[];
 const published:CanvasEntry[]=p.impacts.map(i=>({id:'implemented:'+i.contribution_id,kind:'implemented',title:"公開された改善",at:i.at,href:'/impact/'+i.token}));
 const completed=new Map<string,CanvasEntry>();
 for(const impact of p.impacts)if(impact.task_status==='completed')completed.set(impact.request_id,{id:'completed:'+impact.request_id,kind:'completed',title:"完了したタスク",at:impact.completed_at,href:'/impact/'+impact.token});
 const canvas=[...new Map([...completed.values(),...mine,...published].map(item=>[item.id,item])).values()]
   .sort((a,b)=>b.at.localeCompare(a.at)).slice(0,48);
 return <div className="cm-root cr-public">
   <PublicHeader/>
   <main id="main" tabIndex={-1}>
     <article className="cr-showcase">
       <ShowcaseGallery title={p.title} media={p.media} endpoint={'/api/public/'+p.token+'/image'}/>
       <ShowcaseDetails {...p}>
         <p>作者：{p.creator_label==='A CritOur creator'?'CritOurの作者':p.creator_label}</p>
         <div className="cr-build-actions"><a className="cm-primary" href="#help">{ja.help}</a><ShareButtons path={'/p/'+p.token} token={p.token}/></div>
       </ShowcaseDetails>
     </article>
     <PublicContribution project={{token:p.token,listingId:p.listing_id,requests:p.requests}} signedIn={!!user}/>
     {!!p.seeking&&<p><a href={'/codemate/discover?listing='+encodeURIComponent(p.listing_id)+'#showcase-feedback'}>{ja.sendFeedback} →</a></p>}
     <CreativeCanvas entries={canvas}/>
     {!!p.impacts.length&&<section className="cm-card"><h2>参加から生まれた改善</h2>{p.impacts.map(i=><p key={i.token}><a href={'/impact/'+i.token}>改善内容を見る →</a></p>)}</section>}
     <MeasurementChoice token={p.token}/>
     <footer className="cm-footer">CritOur・誰でも、一緒につくれる場所。</footer>
   </main>
 </div>;
}
