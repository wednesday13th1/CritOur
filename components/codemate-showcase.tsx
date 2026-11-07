'use client';
import {ja, localizeError} from '@/lib/critour-ja';
import {GalleryCover} from './critour-gallery-cover';
import {ShowcaseDetails,ShowcaseGallery} from './critour-showcase-detail';
import {categoryLabel,showcaseCategories as categories} from '@/lib/critour-showcase-media';
import {critourRequest} from '@/lib/critour-client';
import {InstantCollab} from './critour-collab';
import {useEffect,useRef,useState} from 'react';
import {feedbackLabels} from '@/lib/codemate-policy';
const endpoint='/api/codemate/showcase';
async function request(query='',body?:object){
 const res=await fetch(endpoint+query,{cache:'no-store',...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
 const data=await res.json();if(!res.ok)throw Error(localizeError(data.error,'作品を読み込めませんでした。'));return data;
}
export function Showcase({admin}:{admin:boolean}){
 const commentKey=useRef(crypto.randomUUID());
 const [ready,setReady]=useState(false),[friday,setFriday]=useState(false);

 const [query,setQuery]=useState(''),[data,setData]=useState<any>(null),[id,setId]=useState(''),[err,error]=useState(''),[status,setStatus]=useState(''),[busy,setBusy]=useState(false),[reply,setReply]=useState(''),[report,setReport]=useState<string|null>(null),[reports,setReports]=useState<any[]>([]),[offset,setOffset]=useState(0),[retry,setRetry]=useState(0);
 // eslint-disable-next-line react-hooks/set-state-in-effect -- Read URL and local weekday once after hydration so server HTML matches the first client render.
 useEffect(()=>{const isFriday=new Date().getDay()===5;setFriday(isFriday);setQuery(isFriday?'mode=critday':'');setId(new URLSearchParams(location.search).get('listing')||'');setReady(true)},[]);
 useEffect(()=>{if(!ready)return;let active=true;error('');request(id?'?id='+encodeURIComponent(id):'?'+query+'&offset='+offset).then(d=>{if(active)setData(d)}).catch(e=>{if(active)error(localizeError(e.message))});return()=>{active=false}},[id,query,offset,retry,ready]);
 const open=(value:string)=>{const u=new URL(location.href);if(value)u.searchParams.set('listing',value);else u.searchParams.delete('listing');history.replaceState(null,'',u);commentKey.current=crypto.randomUUID();setReply('');setReport(null);setData(null);setId(value)};
 async function send(body:object){
  setBusy(true);error('');setStatus('');
  try{await request('',{...body,clientId:commentKey.current});commentKey.current=crypto.randomUUID();setStatus('保存しました。');setReport(null);setReply('');if((body as any).action!=='report')setRetry(v=>v+1);return true}catch(e:any){error(localizeError(e.message));return false}finally{setBusy(false)}
 }
 const listing=data?.listing;
 return <section className="cm-card">{!id&&<><h2>{ja.findProjects}</h2><p>制作中の作品を試して、気づいたことを伝えよう。</p></>}
 {err&&<p role="alert">{err} <button onClick={()=>setRetry(v=>v+1)}>再試行</button></p>}{status&&<p role="status">{status}</p>}
 {id&&<button onClick={()=>open('')}>作品一覧に戻る</button>}
 {!id&&<><form className="cm-form" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);setOffset(0);setQuery(new URLSearchParams(Array.from(f.entries()).map(([k,v])=>[k,String(v)])).toString())}}>
 <label>プロジェクトを検索<input name="q" maxLength={80}/></label><label>カテゴリ<select name="category"><option value="">すべて</option>{Object.entries(categories).map(([key,value])=><option key={key} value={key}>{value}</option>)}</select></label>
 <label>表示する作品<select name="mode" key={String(friday)} defaultValue={friday?'critday':'updated'}><option value="critday">CritDay・感想を待っている作品</option><option value="updated">最近更新された作品</option><option value="new">新しい作品</option><option value="seeking">感想を募集中</option></select></label><button>絞り込む</button></form>
 <div className="cr-critday"><strong>CritDay・毎週金曜日</strong><p>感想はいつでも送れます。まだ感想が少ない作品を見てみよう。</p></div><div className="cm-card-grid">{data?.listings?.map((s:any)=><article className="cm-card" key={s.id}><GalleryCover src={s.image?endpoint+'/'+s.id+'/image':undefined} title={s.title} category={categoryLabel(s.category,s.kind)} x={s.focusX} y={s.focusY}/><h3>{s.title}</h3><small>{categoryLabel(s.category,s.kind)} · {s.stage==='wip'?'制作途中':'試せる作品'} {s.seeking?"・感想を募集中":''}</small><p>{s.description}</p><button className="cm-primary" onClick={()=>open(s.id)}>この作品に参加する →</button></article>)}</div>
 {data?.listings?.length===0&&<p>条件に合う作品がありません。絞り込みの条件を変えてみてください。</p>}{offset>0&&<button onClick={()=>setOffset(v=>v-24)}>前へ</button>}{data?.more&&offset<2000&&<button onClick={()=>setOffset(v=>v+24)}>次へ</button>}
 </>}
 {!data&&!err&&<p role="status">作品を読み込んでいます…</p>}
 {listing&&<><article className="cr-showcase">
 <ShowcaseGallery title={listing.title} media={listing.media} endpoint={endpoint+'/'+id+'/image'}/>
 <ShowcaseDetails {...listing} level={2}><a className="cm-primary" href="#cr-help">{ja.help}</a></ShowcaseDetails>
 </article><InstantCollab key={id+':'+retry} listing={id}>
 <form id="showcase-feedback" className="cm-form" onSubmit={e=>{e.preventDefault();const form=e.currentTarget;void send({action:'comment',id,commentId:reply||undefined,...Object.fromEntries(new FormData(form))}).then(ok=>{if(ok)form.reset()})}}>
 <label>フィードバックの種類<select name="kind">{Object.entries(feedbackLabels).map(([key,value])=><option key={key} value={key}>{value}</option>)}</select></label>
 <label>{reply?'感想に返信':'作品への感想'}<textarea name="body" required maxLength={1000} placeholder="よかったところや改善アイデアを伝えよう。連絡先は書かないでね。"/></label><button className="cm-primary" disabled={busy}>{ja.sendFeedback}</button>{reply&&<button type="button" onClick={()=>setReply('')}>返信をやめる</button>}</form>
 <button disabled={busy} onClick={()=>setReport('')}>作品を通報</button> <button disabled={busy} onClick={()=>{if(confirm('この投稿者の展示と感想を非表示にしますか？'))void send({action:'block',id}).then(ok=>{if(ok)open('')})}}>投稿者をブロック</button>
 <details><summary>作品へのフィードバック</summary>{data.comments.map((c:any)=><article className="cm-card" key={c.id}><small>{c.parent_id?'返信 · ':''}{feedbackLabels[c.kind as keyof typeof feedbackLabels]} {c.mine?'· 自分':''}</small><p>{c.body}</p>
 {!c.parent_id&&<button onClick={()=>setReply(c.id)}>返信</button>} <button onClick={()=>setReport(c.id)}>通報</button> {!c.mine&&<button disabled={busy} onClick={()=>{if(confirm('この投稿者の展示と感想を非表示にしますか？'))void send({action:'block',id,commentId:c.id})}}>投稿者をブロック</button>} {data.canHide&&<button disabled={busy} onClick={()=>void send({action:'hide',id,commentId:c.id})}>非表示</button>}{data.canReview&&!c.mine&&<button disabled={busy} onClick={()=>{setBusy(true);void critourRequest('',{action:'feedback.promote',listingId:id,commentId:c.id}).then(()=>{setStatus("確認する貢献として登録しました。");setRetry(v=>v+1)}).catch(e=>error(localizeError(e.message))).finally(()=>setBusy(false))}}>貢献として確認する</button>}</article>)}</details>
 {report!==null&&<form className="cm-form" onSubmit={e=>{e.preventDefault();void send({action:'report',id,commentId:report||undefined,reason:new FormData(e.currentTarget).get('reason')})}}><label>通報理由<input name="reason" required maxLength={300}/></label><button disabled={busy}>通報を送る</button><button type="button" onClick={()=>setReport(null)}>キャンセル</button></form>}
 </InstantCollab></>}
 {admin&&<details><summary>通報の管理</summary><button onClick={()=>request('?reports=1').then(d=>setReports(d.reports)).catch(e=>error(localizeError(e.message)))}>通報を読み込む</button>{reports.map((r,i)=><article className="cm-card" key={i}><strong>{r.title}</strong><p>{r.reason}</p>{r.body&&<blockquote>{r.body}</blockquote>}<button disabled={busy||!!r.hidden} onClick={()=>void send({action:'moderate',id:r.listing_id}).then(ok=>{if(ok)setReports(v=>v.map(a=>a.listing_id===r.listing_id?{...a,hidden:1}:a))})}>展示を非表示</button></article>)}</details>}
 </section>
}
const imageTypes = 'image/png,image/jpeg,image/webp';
async function uploadShowcaseImage(project:string,file:File) {
 const form=new FormData();
 form.append('projectId',project);
 form.append('file',file);
 const response=await fetch('/api/codemate/assets',{method:'POST',body:form});
 const data=await response.json();
 if(!response.ok)throw new Error(localizeError(data.error,'画像をアップロードできませんでした。'));
 return data.id as string;
}

export function ShowcaseManager({project,builds,name,description}:{project:string;builds:any[];name:string;description:string}){
 const [rows,setRows]=useState<any[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const [editing,setEditing]=useState<any>(null),[formVersion,setFormVersion]=useState(0);
 const [removeCover,setRemoveCover]=useState(false),[removed,setRemoved]=useState<string[]>([]);
 const [coverFile,setCoverFile]=useState<File|null>(null),[preview,setPreview]=useState<string>();
 const [focusX,setFocusX]=useState(50),[focusY,setFocusY]=useState(50);
 useEffect(()=>{if(!coverFile){setPreview(undefined);return}const url=URL.createObjectURL(coverFile);setPreview(url);return()=>URL.revokeObjectURL(url)},[coverFile]);
 const lock=useRef(false);
 const load=()=>request('?project='+encodeURIComponent(project)).then(d=>setRows(d.listings));
 function select(row:any){
  setEditing(row);setCoverFile(null);setFocusX(row?.focusX??50);setFocusY(row?.focusY??50);setRemoveCover(false);setRemoved([]);setFormVersion(version=>version+1);
 }
 async function save(build:()=>object|Promise<object>){
  if(lock.current)return;
  lock.current=true;setBusy(true);setError('');setNotice('');
  try{await request('',await build());await load();setNotice("保存しました。");return true}
  catch(e){setError(e instanceof Error?e.message:"保存できませんでした。");return false}
  finally{lock.current=false;setBusy(false)}
 }
 return <details className="cm-card" onToggle={e=>{if(e.currentTarget.open)void load().catch(e=>setError(localizeError(e.message)))}}>
 <summary>{ja.showcase}</summary>
 <p>共有する作品情報を選びます。新しい作品紹介は下書きとして保存されます。</p>
 {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
 {rows.map(row=><div className="cr-showcase-row" key={row.id}>
  <strong>{row.title}</strong> · {row.hidden?"管理者が非表示にしました":row.visible?"メンバーに公開中":"下書き"}
  <button type="button" disabled={busy} onClick={()=>select(row)}>{ja.edit}</button>
  <button type="button" disabled={busy||row.hidden} onClick={()=>{if(row.visible||confirm("作品名、説明、画像、リンクをCritOurのメンバーに公開しますか？"))void save(()=>({action:'visibility',id:row.id,visible:!row.visible}))}}>{row.visible?"非公開にする":"メンバーに公開"}</button>
  {row.visible&&<a href={'/codemate/discover?listing='+encodeURIComponent(row.id)}>作品紹介を見る →</a>}
 </div>)}
 {editing&&<button type="button" disabled={busy} onClick={()=>select(null)}>新しい作品紹介</button>}
 <form className="cm-form" key={formVersion} onSubmit={e=>{
  e.preventDefault();
  const f=new FormData(e.currentTarget);
  if(editing?.visible&&!confirm("公開中の作品紹介を更新しますか？公開リンクにも変更が反映されます。"))return;
  void save(async()=>{
   const cover=f.get('cover'),newShots=f.getAll('screenshots').filter((file):file is File=>file instanceof File&&file.size>0);
   const screenshots:string[]=(editing?.media.screenshots||[]).filter((id:string)=>!removed.includes(id));
   if(screenshots.length+newShots.length>6)throw new Error("スクリーンショットは6枚まで選べます。");
   const coverId=cover instanceof File&&cover.size?await uploadShowcaseImage(project,cover):removeCover?null:editing?.media.cover||null;
   for(const shot of newShots)screenshots.push(await uploadShowcaseImage(project,shot));
   return {action:'draft',id:editing?.id,projectId:project,buildId:f.get('buildId'),title:f.get('title'),description:f.get('description'),
    tags:String(f.get('tags')||'').split(/[,、]/).map(tag=>tag.trim()).filter(Boolean),focusX,focusY,category:f.get('category'),stage:f.get('stage'),seeking:f.has('seeking'),coverId,screenshots,demo:f.get('demo'),video:f.get('video'),github:f.get('github')};
  }).then(ok=>{if(ok)select(null)});
 }}>
 <h3>{editing?"作品紹介を編集":"新しい作品紹介"}</h3>
 <label>作品名<input name="title" defaultValue={editing?.title||name} required maxLength={100}/></label>
 <label>作品の説明<textarea name="description" defaultValue={editing?.description??description.slice(0,1000)} required maxLength={1000}/></label>
 <label>タグ（任意）<input name="tags" maxLength={200} defaultValue={editing?.tags?.join('、')||''} placeholder="例：学習、パズル" aria-describedby="gallery-tag-help"/></label><small id="gallery-tag-help">読点で区切って8件まで。1件24文字以内。</small>
 <div className="cr-fields">
  <label>カテゴリ<select required name="category" defaultValue={editing?(editing.category==='app'?editing.kind:editing.category==='learning'?'other':editing.category):''}>
   <option value="" disabled>カテゴリを選ぶ</option>{Object.entries(categories).map(([key,value])=><option key={key} value={key}>{value}</option>)}
  </select></label>
  <label>制作状況<select name="stage" defaultValue={editing?.stage||'wip'}><option value="wip">制作中</option><option value="ready">試せる状態</option></select></label>
 </div>
 <details className="cr-showcase-optional"><summary>画像とリンク（任意）</summary>
  {!editing&&!!builds.length&&<label>登録済みのバージョンを使う<select name="buildId"><option value="">作品紹介だけを作る</option>{builds.filter(b=>!rows.some(row=>row.buildId===b.id)).map(b=><option key={b.id} value={b.id}>{b.title} · {b.version_label}</option>)}</select></label>}
  <p>画像はPNG・JPEG・WebP、1枚5MBまで。縦横8,192ピクセル以内、合計2,400万画素以内です。</p>
  <label>カバー画像<input name="cover" type="file" accept={imageTypes} onChange={e=>setCoverFile(e.target.files?.[0]||null)}/></label>
  {editing?.media.cover&&<label className="cr-check"><input type="checkbox" checked={removeCover} onChange={e=>setRemoveCover(e.target.checked)}/> 現在のカバー画像を外す</label>}
  <fieldset className="cr-gallery-editor"><legend>一覧で見せる画像の位置</legend>
   <GalleryCover src={preview||(!removeCover&&editing?.media.cover?'/api/codemate/assets/'+editing.media.cover:undefined)}
     title={editing?.title||name} category="サムネイルの見本" x={focusX} y={focusY}/>
   <label>左右の位置<input type="range" min="0" max="100" value={focusX} onChange={e=>setFocusX(+e.target.value)}/></label>
   <label>上下の位置<input type="range" min="0" max="100" value={focusY} onChange={e=>setFocusY(+e.target.value)}/></label>
  </fieldset>
  <label>スクリーンショット（最大6枚）<input name="screenshots" type="file" accept={imageTypes} multiple/></label>
  {editing?.media.screenshots.map((id:string,i:number)=><label className="cr-check" key={id}><input type="checkbox" checked={removed.includes(id)} onChange={e=>setRemoved(previous=>e.target.checked?[...previous,id]:previous.filter(value=>value!==id))}/> スクリーンショットを外す {i+1}</label>)}
  <label>デモURL・配布ページのURL<input name="demo" type="url" maxLength={2000} defaultValue={editing?.media.demo||''}/></label>
  <label>動画URL<input aria-describedby="cr-video-help" name="video" type="url" maxLength={2000} defaultValue={editing?.media.video||''}/></label><small id="cr-video-help">動画には字幕を付け、映像や音声で伝える大切な内容は作品の説明にも書いてください。</small>
  <label>GitHub URL<input name="github" type="url" maxLength={2000} defaultValue={editing?.media.github||''}/></label>
 </details>
 <label className="cr-check"><input type="checkbox" name="seeking" defaultChecked={editing?.seeking??true}/> 感想を募集中</label>
 <button className="cm-primary" disabled={busy}>{busy?"保存しています…":editing?"変更を保存":"下書きを保存"}</button>
 </form></details>
}
