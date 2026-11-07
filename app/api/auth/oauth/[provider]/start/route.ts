import {startOAuth} from '@/lib/critour-oauth';
export async function POST(req:Request,{params}:{params:Promise<{provider:string}>}){return startOAuth(req,(await params).provider)}
