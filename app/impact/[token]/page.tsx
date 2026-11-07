import {PublicHeader} from '@/components/critour-public-ui';
import {env} from 'cloudflare:workers';
import {notFound} from 'next/navigation';
import {headers} from 'next/headers';
import {publicImpact} from '@/lib/critour-public';
import {RequestError} from '@/lib/request-security';
import {ShareButtons,MeasurementChoice} from '@/components/critour-share';
import '../../codemate/codemate.css';
export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{token:string}>}){try{const p=await publicImpact((await params).token),h=await headers(),origin=env.PUBLIC_BASE_URL||env.AUTH_BASE_URL||('https://'+h.get('host'));return {title:'作品の改善・'+p.project_title+' · CritOur',description:p.improvement,robots:{index:false,follow:false},openGraph:{title:p.project_title+" ・みんなで実現した改善",description:p.improvement,type:'website',images:[{url:origin+'/api/impact/'+p.token+'/og',width:1200,height:630}]},twitter:{card:'summary_large_image',images:[origin+'/api/impact/'+p.token+'/og']}}}catch{return {title:"改善内容を表示できません・CritOur"}}}
export default async function Page({params}:{params:Promise<{token:string}>}){let p;try{p=await publicImpact((await params).token)}catch(e){if(e instanceof RequestError&&e.status===404)notFound();throw e;}return <div className="cm-root cr-public"><PublicHeader/><main id="main" tabIndex={-1}><section className="cr-intro"><span className="cm-eyebrow">作品が更新されました</span><h1>ひとつの貢献から、<br/>作品が変わりました。</h1><p>{p.project_title}・協力：{p.contributor==='A CritOur collaborator'?'CritOurの参加者':p.contributor}</p></section><article className="cm-card"><h2>{p.task_title}</h2><div className="cr-comparison"><section><small>改善前</small><p className="cr-body">{p.before_text}</p></section><section><small>あなたのアイデア</small><p className="cr-body">{p.feedback}</p></section><section><small>改善後・変わったところ</small><p className="cr-body">{p.improvement}</p></section></div><ShareButtons path={'/impact/'+p.token} token={p.token} impact/><a className="cm-primary" href={'/p/'+p.project_token+'?via=share'}>この作品に参加する →</a></article><MeasurementChoice token={p.token} impact/><footer className="cm-footer">ひとりで作り、みんなで育てる。・CritOur</footer></main></div>}
