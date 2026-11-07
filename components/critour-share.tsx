'use client';
import {measurementLabels} from '@/lib/critour-ja';
import {useRouter} from 'next/navigation';
import {useEffect,useRef,useState} from 'react';
import {FirstStepLearning} from './critour-learning';
import type {Publication,Visibility,PublicProjectData,CollabData,Metrics} from '@/lib/critour-types';
import {critourRequest,errorMessage} from '@/lib/critour-client';
const KEY='critour-measurement';
export function measurement(){try{const value=JSON.parse(localStorage.getItem(KEY)||'null');if(!value||value.expires<Date.now())return null;return {visitor:value.visitor,source:new URLSearchParams(location.search).get('via')==='share'?'share':'direct'};}catch{return null;}}
export function track(event:string,token:string,impact=false){const identity=measurement();if(identity)void fetch('/api/critour/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...identity,event,token,resource:impact?'impact':'project',eventId:crypto.randomUUID()})}).catch(()=>{});}
export function ShareButtons({path,token,impact=false}:{path:string;token:string;impact?:boolean}){
 const [notice,setNotice]=useState('');const url=()=>new URL(path+'?via=share',location.origin).href;
 return <div className="cr-share"><button onClick={()=>{track('share_clicked',token,impact);if(navigator.share)void navigator.share({title:impact?'A small contribution. A real improvement.':"あなたのアイデアで、この作品を育てませんか？",url:url()}).then(()=>setNotice("共有しました。")).catch((e:unknown)=>{if(!(e instanceof Error)||e.name!=='AbortError')setNotice("共有できませんでした。「リンクをコピー」をお試しください。");});else void navigator.clipboard.writeText(url()).then(()=>setNotice("リンクをコピーしました。")).catch(()=>setNotice(url()));}}>共有</button><button onClick={()=>{track('share_clicked',token,impact);void navigator.clipboard.writeText(url()).then(()=>setNotice("リンクをコピーしました。")).catch(()=>setNotice(url()));}}>リンクをコピー</button>{notice&&<p role="status">{notice}</p>}</div>;
}
export function MeasurementChoice({token,impact=false}:{token:string;impact?:boolean}){
 const [enabled,setEnabled]=useState(false);
 // eslint-disable-next-line react-hooks/set-state-in-effect -- Hydrate the browser-only consent setting once; it is unavailable during SSR.
 useEffect(()=>{setEnabled(!!measurement());track(impact?'impact_viewed':'project_viewed',token)},[token,impact]);
 return <details className="cr-measurement"><summary>プライバシーと利用状況の計測（任意）</summary><p>広告用の追跡は行いません。計測に同意したブラウザーには、90日で失効するランダムなIDを使います。集計期間は90日で、古い記録は次の計測時に削除されます。氏名、メールアドレス、IPアドレス、ページの文章は記録しません。利用者が少ない場合は集計結果を表示しません。</p><label className="cr-check"><input type="checkbox" checked={enabled} onChange={e=>{const on=e.target.checked;setEnabled(on);try{if(on){localStorage.setItem(KEY,JSON.stringify({visitor:crypto.randomUUID(),expires:Date.now()+90*86400000}));track(impact?'impact_viewed':'project_viewed',token)}else localStorage.removeItem(KEY)}catch{setEnabled(false)}}}/> 利用状況の計測に同意する</label></details>;
}
const waysToHelp = [
  { kind:'test', label:"作品を試す", hint:"作品を使って、気づいたことを作者に伝える。", feedback:'good' },
  { kind:'idea', label:"アイデアを送る", hint:"もっとよくなる工夫を一つ提案する。", feedback:'idea' },
  { kind:'design', label:"見た目や使いやすさを改善する", hint:"わかりやすさや操作のしやすさを見直す。", feedback:'improve' },
  { kind:'code', label:"プログラムを書く", hint:"小さなプログラミングの課題に取り組む。", feedback:'improve' },
];

export function PublicContribution({project,signedIn}:{project:PublicProjectData;signedIn:boolean}) {
  const [category,setCategory] = useState('');
  const [selected,setSelected] = useState('');
  const [body,setBody] = useState('');
  const [notice,setNotice] = useState('');
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const router = useRouter();
  const [success,setSuccess] = useState(false);
  const [submitted,setSubmitted] = useState<string[]>([]);
  const clientId = useRef('');
  const draftKind = useRef('');
  const locked = useRef(false);
  const formHeading = useRef<HTMLHeadingElement>(null);
  const successHeading = useRef<HTMLHeadingElement>(null);
  const taskHeading = useRef<HTMLHeadingElement>(null);
  const storage = 'critour-draft:' + project.token;

  // A saved draft is read after hydration so its contents stay out of server HTML.
  useEffect(() => {
    try {
      const draft = JSON.parse(sessionStorage.getItem(storage) || 'null');
      if (!draft || draft.expires <= Date.now()) return;
      const savedTask = project.requests.find(task => task.id === draft.requestId);
      if (!savedTask) {
        setBody(typeof draft.body === 'string' ? draft.body : '');
        setNotice("下書きのタスクは募集を終了しました。別のタスクを選ぶと、保存した文章を確認できます。");
        return;
      }
      setCategory(savedTask.kind);
      setSelected(savedTask.id);
      setBody(draft.body);
      clientId.current = typeof draft.clientId === 'string' ? draft.clientId : '';
      draftKind.current = ['good','idea','improve'].includes(draft.kind) ? draft.kind : '';
      setNotice("下書きを復元しました。送信前に内容を確認してください。");
    } catch { /* Storage is optional until sign-in. */ }
  }, [storage,project.requests]);

  useEffect(() => {
    if (!signedIn) return;
    let active = true;
    void critourRequest<CollabData>('?listing=' + encodeURIComponent(project.listingId))
      .then(data => {
        if (active) setSubmitted(previous => [...new Set([...previous,...data.contributions.map(c => c.request_id)])]);
      }).catch(() => {});
    return () => { active = false; };
  }, [signedIn,project.listingId]);

  useEffect(() => { if (selected) formHeading.current?.focus(); }, [selected]);
  useEffect(() => { if (category && !selected) taskHeading.current?.focus(); }, [category,selected]);
  useEffect(() => { if (success) successHeading.current?.focus(); }, [success]);

  const request = project.requests.find(task => task.id === selected);
  const way = waysToHelp.find(option => option.kind === category);
  const progressLink = '/codemate/discover?listing=' + encodeURIComponent(project.listingId);

  async function submit() {
    if (!request || locked.current) return;
    setError('');
    if (!clientId.current) clientId.current = crypto.randomUUID();
    const kind = draftKind.current || (waysToHelp.find(option => option.kind === request.kind)?.feedback ?? 'idea');
    if (!signedIn) {
      try {
        sessionStorage.setItem(storage, JSON.stringify({
          requestId:request.id,body,kind,clientId:clientId.current,expires:Date.now()+86400000,
        }));
      } catch {
        setError("下書きを保存できませんでした。入力した文章をコピーしてからログインしてください。");
        return;
      }
      location.assign('/codemate/login?returnTo=' + encodeURIComponent('/p/' + project.token));
      return;
    }
    locked.current = true;
    setBusy(true);
    try {
      await critourRequest('',{action:'submit',requestId:request.id,body,kind,clientId:clientId.current,analytics:measurement()});
      try { sessionStorage.removeItem(storage); } catch { /* The submission is already saved. */ }
      setSubmitted(previous => [...previous,request.id]);
      setBody('');
      setNotice('');
      setSuccess(true);
      router.refresh();
    } catch (cause) { setError(errorMessage(cause)); }
    finally { locked.current = false; setBusy(false); }
  }

  function chooseTask(id:string) {
    if (id !== selected) { clientId.current = ''; draftKind.current = ''; }
    setSelected(id);
    setError('');
    track('collaboration_started',project.token);
  }

  return <section id="help" className="cr-open-collab cr-help-flow" aria-labelledby="help-title">
    <h2 id="help-title">どんな方法で参加しますか？</h2>
    {notice && <p className="cm-notice" role="status">{notice}</p>}
    {success ? <section className="cm-card cr-help-success" data-event="feedback">
      <h3 tabIndex={-1} ref={successHeading}>送信しました！</h3>
      <p>作者に届きました。返信や進み具合は通知で確認できます。</p>
      <a href={progressLink}>送った内容を見る →</a>
      <FirstStepLearning/>
      <button type="button" onClick={() => {setSuccess(false);setSelected('');setCategory('');}}>ほかの参加方法を見る</button>
    </section> : !project.requests.length ? <div className="cm-empty">
      <h3>募集中のタスクはありません。</h3><a href="/explore">別の作品を探す →</a>
    </div> : request && !submitted.includes(request.id) ? <form className="cm-card cm-form cr-help-form" onSubmit={event => {event.preventDefault();void submit();}}>
      <h3 ref={formHeading} tabIndex={-1}>{request.title}</h3>
      <p className="cr-body">{request.instructions}</p>
      <label>送る内容<textarea id="public-contribution" required maxLength={4000} value={body} onChange={event=>setBody(event.target.value)} placeholder="気づいたことや変えたいところを、一つ書いてみましょう。"/></label>
      <small>連絡先などの個人情報は書かないでください。 {!signedIn && "ログインしても、下書きはこのタブに残ります。"}</small>
      {error && <p className="cm-error" role="alert">{error}</p>}
      <button className="cm-primary" disabled={busy}>{busy?"送信しています…":signedIn?"送信する":"ログインして送信"}</button>
      <button type="button" disabled={busy} onClick={() => {setSelected('');setError('');}}>タスク一覧に戻る</button>
    </form> : way ? <section>
      <h3 ref={taskHeading} tabIndex={-1}>{way.label}</h3>
      <button type="button" onClick={() => {setCategory('');setSelected('');}}>参加方法を選び直す</button>
      <div className="cm-card-grid cr-help-tasks">
        {project.requests.filter(task => task.kind === category).map(task => <article key={task.id} className="cm-card">
          <h4>{task.title}</h4>
          <div className="cr-card-tags"><span className="cm-chip">約{task.minutes}分</span>{!!task.no_code && <span className="cm-chip">プログラミング不要</span>}</div>
          <p className="cr-body">{task.instructions}</p>
          {task.required_skills && <p>必要なこと： {task.required_skills}</p>}
          <button className="cm-primary" disabled={submitted.includes(task.id)} onClick={() => chooseTask(task.id)}>{submitted.includes(task.id)?"送信済み":"このタスクを選ぶ"}</button>
        </article>)}
      </div>
    </section> : <div className="cr-help-options">
      {waysToHelp.map(option => {
        const available = project.requests.some(task => task.kind === option.kind);
        return <button key={option.kind} type="button" disabled={!available} onClick={() => {setCategory(option.kind);setSelected('');}}>
          <strong>{option.label}</strong><span>{available ? option.hint : "募集中のタスクはありません"}</span>
        </button>;
      })}
    </div>}
  </section>;
}

export function PublicationSettings({listing,publication}:{listing:string;publication:Publication|null}){
 const [notice,setNotice]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[path,setPath]=useState(publication?.published?'/p/'+publication.token:'');
 async function save(published:boolean,form:HTMLFormElement){setBusy(true);setError('');try{const f=new FormData(form);const result=await critourRequest<{path:string}>('',{action:'publication.save',listingId:listing,published,creatorLabel:f.get('creator'),confirm:f.has('confirm')});setPath(published?result.path:'');setNotice(published?"作品ページを公開しました。確認した項目だけが公開されます。":"公開リンクを無効にしました。");}catch(e){setError(errorMessage(e))}finally{setBusy(false)}}
 return <details className="cm-card"><summary>作品ページの公開</summary><p>あなたのアイデアで、この作品を育てませんか？</p><p>公開すると、作品名・説明・画像・リンク・募集中のタスクを誰でも見られます。チーム内の会話、メンバー情報、非公開のタスクは公開されません。作者の表示にはニックネームを使えます。</p><form className="cm-form" onSubmit={e=>{e.preventDefault();void save(true,e.currentTarget)}}><label>公開する作者名<input name="creator" required maxLength={80} defaultValue={publication?.creator_label||"CritOurの作者"}/></label><label className="cr-check"><input type="checkbox" name="confirm" required/> 作品情報、画像、リンク、タスクを確認し、公開に同意します。</label><button className="cm-primary" disabled={busy}>作品ページを公開</button>{publication&&<button disabled={busy} type="button" onClick={e=>void save(false,e.currentTarget.form!)}>公開リンクを無効にする</button>}</form>{error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}{path&&<><a href={path}>公開ページを見る →</a><ShareButtons path={path} token={path.split('/').pop()!}/></>}</details>;
}
export function ImpactPublisher({listing,contribution,publication}:{listing:string;contribution:string;publication:Publication|null}){
 const [path,setPath]=useState(publication?.published?'/impact/'+publication.token:''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function save(published:boolean,confirm=false){setBusy(true);setError('');try{const r=await critourRequest<{path:string}>('',{action:'impact.publish',listingId:listing,contributionId:contribution,published,confirm});setPath(published?r.path:'');}catch(e){setError(errorMessage(e))}finally{setBusy(false)}}
 return <details><summary>この改善を共有する</summary><form className="cm-form" onSubmit={e=>{e.preventDefault();void save(true,new FormData(e.currentTarget).has('confirm'))}}><p>タスクの説明、届いた提案、記録された改善内容を公開します。投稿者の名前は、本人が公開を許可した場合だけ表示します。</p><label className="cr-check"><input name="confirm" type="checkbox" required/> 改善が反映済みであることを確認し、内容の公開に同意します。</label><button disabled={busy}>改善内容を公開</button></form>{path&&<><a href={path}>公開した改善内容を見る →</a><ShareButtons path={path} token={path.split('/').pop()!} impact/><button disabled={busy} onClick={()=>void save(false)}>改善の公開リンクを無効にする</button></>}{error&&<p role="alert">{error}</p>}</details>;
}
export function ProfileVisibility({initial}:{initial:Visibility|null}){
 const [status,setStatus]=useState('');return <details className="cm-card"><summary>名前の公開設定</summary><p>共有された改善ページでは、初期設定であなたの名前は非表示です。名前を表示したい場合はニックネームを設定できます。マイページは非公開のままです。</p><form className="cm-form" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void critourRequest('',{action:'profile.visibility',showName:f.has('show'),label:f.get('label')}).then(()=>setStatus("名前の公開設定を保存しました。")).catch(e=>setStatus(errorMessage(e)))}}><label>公開用のニックネーム<input name="label" maxLength={80} defaultValue={initial?.public_label||''}/></label><label className="cr-check"><input name="show" type="checkbox" defaultChecked={!!initial?.show_name}/> 公開される改善ページにこの名前を表示する</label><button>公開設定を保存</button><p role="status">{status}</p></form></details>;
}
export function GrowthMetrics({listing}:{listing:string}){
 const [data,setData]=useState<Metrics|null>(null),[error,setError]=useState('');return <details className="cm-card" onToggle={e=>{if(e.currentTarget.open)void critourRequest<Metrics>('?analytics='+encodeURIComponent(listing)).then(setData).catch(e=>setError(errorMessage(e)))}}><summary>利用状況（過去90日）</summary>{error&&<p role="alert">{error}</p>}{!data&&!error&&<p role="status">利用状況を読み込んでいます…</p>}{data&&<><p>{data.notice}</p>{data.cohort?<dl className="cr-metrics"><dt>閲覧から投稿につながった割合</dt><dd>{Math.round(data.cohort.contributors/data.cohort.visitors*100)}%</dd><dt>最初の投稿までの平均時間</dt><dd>{Math.round(data.cohort.seconds_to_first||0)}秒</dd><dt>共有リンクから参加した人</dt><dd>{data.cohort.share_contributors||0}</dd><dt>7日後に再訪した割合</dt><dd>{data.cohort.eligible7>=5?Math.round(data.cohort.retained7/data.cohort.eligible7*100)+'%':"集計に必要なデータがありません"}</dd><dt>30日後に再訪した割合</dt><dd>{data.cohort.eligible30>=5?Math.round(data.cohort.retained30/data.cohort.eligible30*100)+'%':"集計に必要なデータがありません"}</dd></dl>:<p>計測に同意したブラウザーが5件以上になると、割合を表示します。</p>}<p>提案を採用したプロジェクト： {data.projectResponse.rate===null?"公開中のプロジェクトはありません":Math.round(data.projectResponse.rate*100)+'% ('+data.projectResponse.projectsWithUsefulResponse+'/'+data.projectResponse.publishedProjects+')'}</p><p>採用された投稿の割合： {data.usefulResponse?Math.round(data.usefulResponse.rate*100)+'%':"集計できる投稿はまだありません"}</p><ul>{data.events.map(e=><li key={e.event}>{measurementLabels[e.event]||'その他の操作'}: {e.events}</li>)}</ul></>}</details>;
}
