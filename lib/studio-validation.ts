import {RequestError} from '@/lib/request-security';
export const taskStates=['backlog','todo','in_progress','in_review','done'];
export const taskPriorities=['low','medium','high','urgent'];
export const reactionEmoji=['👍','♡','✨','🎉','👀','✅'];
export const clientKey=(value:unknown)=>{if(typeof value!=='string'||!/^[a-zA-Z0-9_-]{16,100}$/.test(value))throw new RequestError('操作IDを確認してください。');return value};
export const textField=(v:unknown,max:number,required=false)=>{if(typeof v!=='string'||v.length>max||required&&!v.trim())throw new RequestError('入力内容と文字数を確認してください。');return v.trim()};
export function githubReference(v:unknown){if(v===null||v===undefined||v==='')return null;if(typeof v!=='string'||v.length>500)throw new RequestError('GitHub URLを確認してください。');let u:URL;try{u=new URL(v)}catch{throw new RequestError('GitHub URLを確認してください。')};if(u.protocol!=='https:'||u.hostname!=='github.com'||u.username||u.password||u.port||!/^\/[\w.-]+\/[\w.-]+\/(issues|pull)\/\d+$/.test(u.pathname))throw new RequestError('GitHubのIssueまたはPRのURLを指定してください。');return u.origin+u.pathname;}
export function mentionIds(content:string){return [...new Set([...content.matchAll(/@\[[^\]\n]{1,80}\]\(member:([a-zA-Z0-9_-]{1,100})\)/g)].map(m=>m[1]))].slice(0,20)}
