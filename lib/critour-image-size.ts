export function imageSize(bytes:Uint8Array,mime:string):[number,number]|undefined {
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 const ascii=(offset:number,text:string)=>[...text].every((char,i)=>bytes[offset+i]===char.charCodeAt(0));
 if(mime==='image/png'&&bytes.length>=33&&view.getUint32(8)===13&&ascii(12,'IHDR'))return [view.getUint32(16),view.getUint32(20)];
 if(mime==='image/jpeg'){
  for(let i=2;i+4<=bytes.length;){
   if(bytes[i++]!==255)return;
   while(bytes[i]===255)i++;
   const marker=bytes[i++];
   if(marker===218||marker===217||i+2>bytes.length)return;
   const length=view.getUint16(i);
   if(length<2||i+length>bytes.length)return;
   if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)&&length>=8)return [view.getUint16(i+5),view.getUint16(i+3)];
   i+=length;
  }
 }
 if(mime==='image/webp'&&bytes.length>=25&&view.getUint32(4,true)+8===bytes.length){
  for(let i=12;i+8<=bytes.length;){
   const length=view.getUint32(i+4,true),d=i+8;
   if(d+length>bytes.length)return;
   if(ascii(i,'VP8X')&&length>=10){
    const u24=(offset:number)=>bytes[offset]+bytes[offset+1]*256+bytes[offset+2]*65536;
    return [1+u24(d+4),1+u24(d+7)];
   }
   if(ascii(i,'VP8L')&&length>=5&&bytes[d]===47){
    const bits=view.getUint32(d+1,true);
    return [1+(bits&16383),1+((bits>>>14)&16383)];
   }
   if(ascii(i,'VP8 ')&&length>=10&&bytes[d+3]===157&&bytes[d+4]===1&&bytes[d+5]===42)return [view.getUint16(d+6,true)&16383,view.getUint16(d+8,true)&16383];
   i=d+length+(length%2);
  }
 }
}
