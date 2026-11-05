import { NextResponse } from 'next/server';
export async function POST() { return NextResponse.json({error:'Shared passcode login has been replaced. Sign in at /admin with your individual account.'},{status:410}); }
