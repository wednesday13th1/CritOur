export class RequestError extends Error {
  status:number;
  constructor(message:string,status=400){super(message);this.status=status}
}
// Bound streamed bodies too: Content-Length is advisory and can be absent.
export async function readJson(req:Request,maxBytes=65536):Promise<Record<string,any>> {
  if(req.headers.get('content-type')?.toLowerCase().split(';')[0].trim()!=='application/json')throw new RequestError('JSON required',415);
  const bytes=await readBody(req,maxBytes);
  try{const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));if(!value||typeof value!=='object'||Array.isArray(value))throw Error();return value}catch{throw new RequestError('Invalid JSON')}
}
export const noStore={'Cache-Control':'private, no-store, max-age=0','Pragma':'no-cache'};

export async function readBody(req:Request,maxBytes:number):Promise<Uint8Array>{
  const reader=req.body?.getReader();if(!reader)throw new RequestError('Invalid body');
  const chunks:Uint8Array[]=[];let size=0,exceeded=Number(req.headers.get('content-length'))>maxBytes;
  // Drain modest overruns without retaining them. This also avoids resetting a
  // reused HTTP connection with an unread small body. Never drain indefinitely.
  try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;
    if(size>maxBytes)exceeded=true;
    if(!exceeded)chunks.push(part.value);
    if(size>maxBytes+65536){void reader.cancel().catch(()=>{});break;}
  }}finally{reader.releaseLock()}
  if(exceeded)throw new RequestError('Request too large',413);
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
  return bytes;
}
