import Link from 'next/link';
import {Suspense} from 'react';
import {PublicHeader} from '@/components/critour-public-ui';
import {GalleryCover} from '@/components/critour-gallery-cover';
import {publicDirectory} from '@/lib/critour-discovery';
import {categoryLabel,showcaseCategories} from '@/lib/critour-showcase-media';
import {getAdminUser} from '@/lib/admin-auth';
import '../codemate/codemate.css';

export const dynamic='force-dynamic';
export const metadata={title:'さがす・CritOur',description:'作品を探して、小さな一歩から一緒につくろう。'};

const filters = {beginner:'初心者歓迎',tasks:'タスク募集中',feedback:'フィードバック募集中'} as const;

async function Gallery({params,userId}:{params:URLSearchParams;userId?:string}) {
 let projects;
 try {projects=await publicDirectory(params,userId)}
 catch(error){console.error('Gallery query failed',error);return <section className="cm-empty" role="alert"><h2>作品を読み込めませんでした。</h2><Link href={'/explore?'+params.toString()}>もう一度読み込む</Link></section>}

 if(!projects.length)return <section className="cm-empty" role="status">
   <h2>条件に合う公開作品はありません。</h2>
   <p>検索語や絞り込みの条件を変えてみてください。</p>
   <Link href="/explore">条件をリセット</Link>
 </section>;
 return <><p role="status" aria-live="polite">検索結果：{projects.length}件{projects.length===24?'を表示':''}</p><div className="cr-gallery-grid" aria-label="検索結果">
   {projects.map(project=>{
     const category=categoryLabel(project.category,project.kind);
     return <article key={project.token}>
       <Link className="cr-gallery-link" href={'/p/'+project.token} aria-labelledby={'title-'+project.token} aria-describedby={'category-'+project.token+' status-'+project.token}>
         <GalleryCover src={project.image?'/api/public/'+project.token+'/image':undefined}
           title={project.title} category={category} x={project.focusX} y={project.focusY}/>
         <div className="cr-gallery-info">
           <p id={'category-'+project.token} className="cr-gallery-category">{category}</p>
           <h2 id={'title-'+project.token}>{project.title}</h2>
           {project.description&&<p className="cr-gallery-description">{project.description}</p>}
           <div id={'status-'+project.token} className="cr-gallery-badges">
             <span>{project.requests?'タスク募集中':project.seeking?'フィードバック募集中':'募集なし'}</span>
             {!!project.beginner&&<span>初心者歓迎</span>}
           </div>
         </div>
       </Link>
     </article>;
   })}
 </div></>;
}

function GallerySkeleton(){
 return <div role="status"><span className="cm-sr-only">作品を読み込んでいます…</span>
   <div className="cr-gallery-grid" aria-hidden="true">{Array.from({length:8},(_,i)=>
     <div key={i} className="cr-gallery-skeleton"><div className="cr-gallery-cover"/><span/><span/></div>)}</div>
 </div>;
}

export default async function Explore({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const [query,user]=await Promise.all([searchParams,getAdminUser()]);
 const params=new URLSearchParams();
 for(const key of ['q','category','sort','mode',...Object.keys(filters)]){
   const value=query[key];
   if(typeof value==='string')params.set(key,value);
 }
 const mode=params.get('mode');
 const initialCategory=params.get('category')||'';
 return <div className="cm-root cr-public"><PublicHeader current="Explore"/><main id="main" tabIndex={-1} className="cr-gallery-page">
   <header className="cr-gallery-heading"><h1>さがす</h1><p>気になる作品を見つけて、試してみよう。</p></header>
   <form className="cr-gallery-search" action="/explore">
     <label>作品を検索<input type="search" name="q" maxLength={80} defaultValue={params.get('q')||''} placeholder="作品名・説明・タグ"/></label>
     <label>カテゴリ<select name="category" defaultValue={Object.hasOwn(showcaseCategories,initialCategory)?initialCategory:''}>
       <option value="">すべて</option>
       {Object.entries(showcaseCategories).map(([key,label])=><option key={key} value={key}>{label}</option>)}
     </select></label>
     <label>並び替え<select name="sort" defaultValue={params.get('sort')==='new'?'new':'updated'}>
       <option value="updated">更新順</option><option value="new">新着順</option>
     </select></label>
     <fieldset><legend>絞り込み</legend>{Object.entries(filters).map(([key,label])=>
       <label key={key}><input type="checkbox" name={key} value="1"
         defaultChecked={params.get(key)==='1'||mode===({beginner:'beginner',tasks:'collab',feedback:'feedback'}[key])||(key==='feedback'&&mode==='critday')}/>{label}</label>)}
     </fieldset>
     <button className="cm-primary">検索する</button>
   </form>
   <div className="cr-gallery-shortcuts">
     <Link href="/explore?mode=critday">CritDay・感想を待っている作品</Link>
     {user&&<Link href="/codemate/discover">メンバー向けの作品を見る</Link>}
   </div>
   <Suspense key={params.toString()} fallback={<GallerySkeleton/>}><Gallery params={params} userId={user?.accountId}/></Suspense>
 </main></div>;
}
