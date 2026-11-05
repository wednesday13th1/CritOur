'use client';
import {useEffect,useState} from 'react';
import {feedbackLabels} from '@/lib/codemate-policy';
const endpoint='/api/codemate/showcase';
const categories={app:'アプリ',game:'ゲーム',learning:'学習',other:'その他'};
async function request(query='',body?:object){
 const res=await fetch(endpoint+query,{cache:'no-store',...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
 const data=await res.json();if(!res.ok)throw Error(data.error||'読み込めませんでした。');return data;
}
export function Showcase({admin}:{admin:boolean}){
 const [query,setQuery]=useState(''),[data,setData]=useState<any>(null),[id,setId]=useState(''),[err,error]=useState(''),[status,setStatus]=useState(''),[busy,setBusy]=useState(false),[play,setPlay]=useState(false),[reply,setReply]=useState(''),[report,setReport]=useState<string|null>(null),[reports,setReports]=useState<any[]>([]),[offset,setOffset]=useState(0),[retry,setRetry]=useState(0);
 useEffect(()=>{let active=true;setData(null);error('');request(id?'?id='+encodeURIComponent(id):'?'+query+'&offset='+offset).then(d=>{if(active)setData(d)}).catch(e=>{if(active)error(e.message)});return()=>{active=false}},[id,query,offset,retry]);
 const open=(value:string)=>{setPlay(false);setReply('');setReport(null);setId(value)};
 async function send(body:object){
  setBusy(true);error('');setStatus('');
  try{await request('',body);setStatus('保存しました。');setReport(null);setReply('');if((body as any).action!=='report')setRetry(v=>v+1);return true}catch(e:any){error(e.message);return false}finally{setBusy(false)}
 }
 const listing=data?.listing;
 return <section className="cm-card"><p className="cm-eyebrow">COMMUNITY · SHOW &amp; GROW ♡</p><h2>{listing?.title||'作品を見つけよう'}</h2><p>学生が作った作品を試して、次の改善につながる感想を届けよう。</p>
 {err&&<p role="alert">{err} <button onClick={()=>setRetry(v=>v+1)}>再読み込み</button></p>}{status&&<p role="status">{status}</p>}
 {id&&<button onClick={()=>open('')}>作品一覧に戻る</button>}
 {!id&&<><form className="cm-form" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);setOffset(0);setQuery(new URLSearchParams(Array.from(f.entries()).map(([k,v])=>[k,String(v)])).toString())}}>
 <label>作品を検索<input name="q" maxLength={80}/></label><label>カテゴリ<select name="category"><option value="">すべて</option>{Object.entries(categories).map(([key,value])=><option key={key} value={key}>{value}</option>)}</select></label>
 <label>見る順番<select name="mode"><option value="updated">最近の更新</option><option value="new">新着作品</option><option value="seeking">感想募集中</option></select></label><button>絞り込む</button></form>
 <div className="cm-card-grid">{data?.listings?.map((s:any)=><article className="cm-card" key={s.id}>{s.image&&<img loading="lazy" width="320" src={endpoint+'/'+s.id+'/image'} alt={s.title+'のスクリーンショット'}/>}<h3>{s.title}</h3><small>{s.kind==='ios'?'iOS':'Web'} · {s.stage==='wip'?'制作途中':'試せる作品'} {s.seeking?'· 感想募集中':''}</small><p>{s.description}</p><button className="cm-primary" onClick={()=>open(s.id)}>作品を開く</button></article>)}</div>
 {data?.listings?.length===0&&<p>条件に合う作品はまだありません。</p>}{offset>0&&<button onClick={()=>setOffset(v=>v-24)}>前の作品</button>}{data?.more&&offset<2000&&<button onClick={()=>setOffset(v=>v+24)}>次の作品</button>}
 </>}
 {!data&&!err&&<p role="status">作品を読み込み中…</p>}
 {listing&&<><p>{listing.description}</p><small>{listing.version}</small>
 {listing.image&&<img width="480" src={endpoint+'/'+id+'/image'} alt={listing.title+'のスクリーンショット'}/>}
 {listing.preview?<div><button className="cm-primary" onClick={()=>setPlay(true)}>試す</button> <a href={listing.preview} target="_blank" rel="noopener noreferrer">別タブで開く ↗</a>{play&&<iframe title={listing.title+'のWebプレビュー'} src={listing.preview} sandbox="allow-scripts" referrerPolicy="no-referrer" style={{width:'100%',minHeight:360,border:'1px solid #dedbf0'}}/>}</div>:<p>iOS作品はスクリーンショットで確認できます。</p>}
 <form className="cm-form" onSubmit={e=>{e.preventDefault();const form=e.currentTarget;void send({action:'comment',id,commentId:reply||undefined,...Object.fromEntries(new FormData(form))}).then(ok=>{if(ok)form.reset()})}}>
 <label>感想の種類<select name="kind">{Object.entries(feedbackLabels).map(([key,value])=><option key={key} value={key}>{value}</option>)}</select></label>
 <label>{reply?'感想に返信':'作品への感想'}<textarea name="body" required maxLength={1000} placeholder="よかったところや改善アイデアを伝えよう。連絡先は書かないでね。"/></label><button className="cm-primary" disabled={busy}>感想を送る</button>{reply&&<button type="button" onClick={()=>setReply('')}>返信をやめる</button>}</form>
 <button disabled={busy} onClick={()=>setReport('')}>作品を通報</button> <button disabled={busy} onClick={()=>{if(confirm('この投稿者の展示と感想を非表示にしますか？'))void send({action:'block',id}).then(ok=>{if(ok)open('')})}}>投稿者をブロック</button>
 {data.comments.map((c:any)=><article className="cm-card" key={c.id}><small>{c.parent_id?'返信 · ':''}{feedbackLabels[c.kind as keyof typeof feedbackLabels]} {c.mine?'· 自分':''}</small><p>{c.body}</p>
 {!c.parent_id&&<button onClick={()=>setReply(c.id)}>返信</button>} <button onClick={()=>setReport(c.id)}>通報</button> {!c.mine&&<button disabled={busy} onClick={()=>{if(confirm('この投稿者の展示と感想を非表示にしますか？'))void send({action:'block',id,commentId:c.id})}}>投稿者をブロック</button>} {data.canHide&&<button disabled={busy} onClick={()=>void send({action:'hide',id,commentId:c.id})}>非表示</button>}</article>)}
 {report!==null&&<form className="cm-form" onSubmit={e=>{e.preventDefault();void send({action:'report',id,commentId:report||undefined,reason:new FormData(e.currentTarget).get('reason')})}}><label>通報理由<input name="reason" required maxLength={300}/></label><button disabled={busy}>通報を送る</button><button type="button" onClick={()=>setReport(null)}>キャンセル</button></form>}
 </>}
 {admin&&<details><summary>通報の管理</summary><button onClick={()=>request('?reports=1').then(d=>setReports(d.reports)).catch(e=>error(e.message))}>通報を読み込む</button>{reports.map((r,i)=><article className="cm-card" key={i}><strong>{r.title}</strong><p>{r.reason}</p>{r.body&&<blockquote>{r.body}</blockquote>}<button disabled={busy||!!r.hidden} onClick={()=>void send({action:'moderate',id:r.listing_id}).then(ok=>{if(ok)setReports(v=>v.map(a=>a.listing_id===r.listing_id?{...a,hidden:1}:a))})}>展示を非表示</button></article>)}</details>}
 </section>
}
export function ShowcaseManager({project,builds}:{project:string;builds:any[]}){
 const [rows,setRows]=useState<any[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const load=()=>request('?project='+encodeURIComponent(project)).then(d=>setRows(d.listings));
 async function save(body:object){setBusy(true);setError('');setNotice('');try{await request('',body);await load();setNotice('保存しました。')}catch(e:any){setError(e.message)}finally{setBusy(false)}}
 return <details className="cm-card" onToggle={e=>{if(e.currentTarget.open)void load().catch(e=>setError(e.message))}}><summary>Show &amp; Growに作品を展示する</summary>
 <p>下書きは非公開です。タイトル・画像・プレビューに個人情報が含まれないことを確認してください。</p>
 {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
 <form className="cm-form" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void save({...Object.fromEntries(f),seeking:f.has('seeking'),action:'draft',projectId:project})}}>
 <label>展示するバージョン<select required name="buildId"><option value="">選択してください</option>{builds.map(b=><option key={b.id} value={b.id}>{b.title} · {b.version_label}</option>)}</select></label>
 <label>展示タイトル<input name="title" required maxLength={100}/></label><label>作品紹介<textarea name="description" maxLength={1000}/></label>
 <label>カテゴリ<select name="category">{Object.entries(categories).map(([key,value])=><option key={key} value={key}>{value}</option>)}</select></label><label>制作状況<select name="stage"><option value="wip">制作途中</option><option value="ready">試せる作品</option></select></label><label><input type="checkbox" name="seeking" defaultChecked/>感想を募集中</label><button disabled={busy}>非公開の下書きを保存</button></form>
 {rows.map(r=><p key={r.id}>{r.title} · {r.hidden?'管理者が非表示':r.visible?'CodeMate内に展示中':'非公開'} <button disabled={busy||r.hidden} onClick={()=>{if(r.visible||confirm('この作品の紹介、画像、プレビューを承認済みのCodeMate利用者に見せますか？'))void save({action:'visibility',id:r.id,visible:!r.visible})}}>{r.visible?'展示を取り消す':'CodeMate内に展示する'}</button></p>)}
 </details>
}
