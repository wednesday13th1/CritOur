import {readBody,RequestError} from '@/lib/request-security';
import {sameOrigin,rateLimit} from '@/lib/admin-auth';
import {env} from 'cloudflare:workers';
import {NextResponse} from 'next/server';
import {requireAdminUser} from '@/lib/cms';
import {audit} from '@/lib/audit';
export async function POST(req:Request){
 if(!sameOrigin(req))return NextResponse.json({error:'Invalid request'},{status:403});
 const user=await requireAdminUser();if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
 try{await rateLimit('upload:'+user.accountId,30)}catch{return NextResponse.json({error:'Too many uploads'},{status:429})}
 if(Number(req.headers.get('content-length'))>8_100_000)return NextResponse.json({error:'Upload too large'},{status:413});
 let form:FormData;try{const bytes=await readBody(req,8_100_000);form=await new Request(req.url,{method:'POST',headers:{'Content-Type':req.headers.get('content-type')||''},body:bytes as BodyInit}).formData()}catch(e){return NextResponse.json({error:'Invalid or oversized upload'},{status:e instanceof RequestError?e.status:400})}
 const file=form.get('file');
 if(!(file instanceof File)||file.size<12||file.size>8_000_000)return NextResponse.json({error:'Choose an image under 8 MB'},{status:400});
 const bytes=new Uint8Array(await file.arrayBuffer());
 const png=[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v);
 const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 const webp=String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
 const format=png?['image/png','png']:jpeg?['image/jpeg','jpg']:webp?['image/webp','webp']:null;
 if(!format||file.type!==format[0])return NextResponse.json({error:'The image contents must match PNG, JPEG or WebP format.'},{status:400});
 if(!env.BUCKET)return NextResponse.json({error:'Image storage unavailable'},{status:503});
 const key=`${form.get("private")==="true"?"private-uploads":"uploads"}/${crypto.randomUUID()}.${format[1]}`;
 await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:format[0]}});await audit('image.upload',key,user);
 return NextResponse.json({url:`/media/${key}`});
}
