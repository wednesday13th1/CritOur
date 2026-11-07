import {NextResponse} from 'next/server';
import {RequestError,noStore} from '@/lib/request-security';
export const studioJson=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:noStore});
export function studioError(e:unknown){
 if(e instanceof RequestError){const response=studioJson({error:e.message},e.status);if(e.status===429)response.headers.set('Retry-After','60');return response;}
 const requestId=crypto.randomUUID();console.error('studio.request.failed',{requestId,type:e instanceof Error?e.name:'UnknownError'});
 return studioJson({error:'Something went wrong. Try again shortly.',requestId},500);
}
export function studioSummary(user:{accountId:string;displayName:string;isStudioAdmin:boolean;canInitialize:boolean}){return {accountId:user.accountId,displayName:user.displayName,isStudioAdmin:user.isStudioAdmin,canInitialize:user.canInitialize}}
