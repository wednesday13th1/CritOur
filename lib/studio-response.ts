import {NextResponse} from 'next/server';
import {RequestError,noStore} from '@/lib/request-security';
export const studioJson=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:noStore});
export function studioError(e:unknown){return studioJson({error:e instanceof RequestError?e.message:'操作できませんでした。入力内容を確認し、少し待ってお試しください。'},e instanceof RequestError?e.status:400)}
export function studioSummary(user:{accountId:string;displayName:string;isStudioAdmin:boolean;canInitialize:boolean}){return {accountId:user.accountId,displayName:user.displayName,isStudioAdmin:user.isStudioAdmin,canInitialize:user.canInitialize}}
