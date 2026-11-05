export const attachmentLimit=10*1024*1024;
const mime:Record<string,string>={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif',pdf:'application/pdf',txt:'text/plain',md:'text/plain',csv:'text/csv',zip:'application/zip',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation'};
export function attachmentPolicy(name:string,bytes:Uint8Array){
 const filename=name.replace(/[\u0000-\u001f\u007f/\\]/g,'_').trim().slice(0,180),ext=filename.split('.').at(-1)?.toLowerCase()||'',type=mime[ext];if(!type||!bytes.length||bytes.length>attachmentLimit)throw Error('10MB以下の画像・PDF・テキスト・ZIP・Officeファイルを選んでください。');
 const starts=(values:number[])=>values.every((n,i)=>bytes[i]===n),ascii=(start:number,n:number)=>new TextDecoder().decode(bytes.slice(start,start+n));
 let valid=false;
 if(ext==='png')valid=starts([137,80,78,71,13,10,26,10]);else if(['jpg','jpeg'].includes(ext))valid=starts([255,216,255]);else if(ext==='webp')valid=ascii(0,4)==='RIFF'&&ascii(8,4)==='WEBP';else if(ext==='gif')valid=['GIF87a','GIF89a'].includes(ascii(0,6));else if(ext==='pdf')valid=ascii(0,5)==='%PDF-';else if(['zip','docx','xlsx','pptx'].includes(ext))valid=starts([80,75,3,4])||ext==='zip'&&starts([80,75,5,6]);else{try{new TextDecoder('utf-8',{fatal:true}).decode(bytes);valid=!bytes.includes(0)}catch{}}
 if(!valid)throw Error('ファイルの内容と拡張子が一致していません。');return {filename,mime:type,ext};
}
