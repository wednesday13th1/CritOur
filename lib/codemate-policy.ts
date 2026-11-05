import {RequestError} from './request-security';
export const feedbackKinds = ['love','idea','confused'] as const;
export const feedbackLabels = {love:'I love…',idea:'What if…?',confused:"I'm confused…"};
export function previewUrl(value:unknown, appOrigin?:string):string|null {
 if(value===null||value===undefined||value==='')return null;
 if(typeof value!=='string'||value.length>2000)throw new RequestError('公開用のHTTPSプレビューURLを入力してください。');
 let u:URL;try{u=new URL(value)}catch{throw new RequestError('URLを確認してください。')}
 // Fixed hosting suffixes only. No server-side fetching or URL redirects.
 const allowed=['vercel.app','netlify.app','pages.dev','github.io','web.app','firebaseapp.com','chatgpt.site'];
 if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash||u.search||u.origin===appOrigin||!allowed.some(h=>u.hostname.endsWith('.'+h))||u.hostname.endsWith('.localhost'))throw new RequestError('対応する公開プレビュー先のHTTPS URLを指定してください。認証情報・クエリ・内部アドレスは使えません。');
 return u.href;
}
export function shortText(value:unknown,max:number,required=true){if(typeof value!=='string'||value.length>max||required&&!value.trim())throw new RequestError('入力内容と文字数を確認してください。');return value.trim()}
export function uiStatus(value:string){return value==='done'?'done':['in_progress','in_review'].includes(value)?'doing':'todo'}
export function nextTask(tasks:any[],account:string){return tasks.filter(t=>t.status!=='done'&&(t.assigneeIds||JSON.parse(t.assignee_ids||'[]')).includes(account)).sort((a,b)=>(uiStatus(a.status)==='doing'?0:1)-(uiStatus(b.status)==='doing'?0:1)||(a.due_date||'9999').localeCompare(b.due_date||'9999')||a.id.localeCompare(b.id))[0]||null}

export function commitUrl(value:unknown):string|null {
 if(value===undefined||value===null||value==='')return null;
 if(typeof value!=='string'||!/^https:\/\/github\.com\/[A-Za-z0-9-]+\/[A-Za-z0-9_.-]+\/commit\/[a-f0-9]{7,64}$/i.test(value))throw new RequestError('GitHubのコミットURLを指定してください。');
 const url=new URL(value);if(url.pathname.split('/').length!==5)throw new RequestError('GitHubのコミットURLを指定してください。');return url.href;
}
