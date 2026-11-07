import {finishOAuth} from '@/lib/critour-oauth';
export async function GET(req:Request,{params}:{params:Promise<{provider:string}>}){return finishOAuth(req,(await params).provider)}
