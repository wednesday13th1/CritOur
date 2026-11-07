import {localizeError} from './critour-ja';

export function errorMessage(error:unknown){return localizeError(error instanceof Error?error.message:undefined);}
export async function critourRequest<T=Record<string,unknown>>(query='',body?:object){
 let res:Response;try{res=await fetch('/api/critour'+query,{cache:'no-store',...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});}catch{throw Error('接続できませんでした。通信状況を確認してからお試しください。');}
 let data;try{data=await res.json()}catch{throw Error('通信が途中で切れました。もう一度お試しください。');}
 if(!res.ok)throw Error(localizeError(data.error)+(data.requestId?' お問い合わせ番号：'+data.requestId:''));return data as T;
}
