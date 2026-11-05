import {env} from 'cloudflare:workers';
// Protection survives deleting the project or replacing its image references.
export async function protectProjectMedia(project:any){
 if(!project?.admin_only)return;
 let gallery=project.gallery;if(typeof gallery==='string'){try{gallery=JSON.parse(gallery)}catch{gallery=[]}}
 const urls=[project.cover_image,project.app_icon,...(Array.isArray(gallery)?gallery:[])].filter((s):s is string=>typeof s==='string'&&/^\/media\/(?:uploads|private-uploads)\/[a-zA-Z0-9.-]+$/.test(s));
 if(urls.length)await env.DB!.batch([...new Set(urls)].map(path=>env.DB!.prepare('INSERT OR IGNORE INTO protected_media(path,protected_at)VALUES(?,?)').bind(path,new Date().toISOString())));
}
