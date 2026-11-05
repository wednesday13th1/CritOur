// Rebuild a deliberately small HTML vocabulary. No source attributes survive.
const escape=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const tags=new Set(['p','h2','h3','h4','strong','b','em','i','u','ul','ol','li','blockquote','br','hr','a','img']);
export function sanitizeHtml(html:string) {
 return html.split(/(<[^>]*>)/g).map(token=>{
  if(!token.startsWith('<'))return token.replace(/</g,'&lt;');
  const match=token.match(/^<\s*(\/?)\s*([a-z0-9]+)([\s\S]*?)>$/i);if(!match)return escape(token);
  const [,closing,raw,attrs]=match,tag=raw.toLowerCase();if(!tags.has(tag))return '';
  if(closing)return ['img','br','hr'].includes(tag)?'':`</${tag}>`;
  if(tag==='a'||tag==='img') {
   const attr=tag==='a'?'href':'src';const value=attrs.match(new RegExp(`(?:^|\\s)${attr}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`,'i'));const url=value?.[1]??value?.[2]??'';
   if(!/^(https?:\/\/|\/media\/uploads\/)/i.test(url)||/[\u0000-\u0020&<>"']/.test(url))return tag==='a'?'<a>':'';
   return tag==='a'?`<a href="${escape(url)}" rel="noopener noreferrer">`:`<img src="${escape(url)}" alt="" loading="lazy">`;
  }
  return `<${tag}>`;
 }).join('');
}
