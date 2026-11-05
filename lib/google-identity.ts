import {createRemoteJWKSet,jwtVerify,type JWTVerifyGetKey} from 'jose';
const googleKeys=createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
export function normalizeGmail(value:unknown){const email=typeof value==='string'?value.trim().toLowerCase():'';return email.length<=254&&/^[a-z0-9][a-z0-9.+_-]*@gmail\.com$/.test(email)?email:null;}
export function randomToken(){return crypto.randomUUID()+crypto.randomUUID();}
export async function pkceChallenge(verifier:string){const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)));return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');}
export async function verifyGoogleIdentity(token:string,clientId:string,nonce:string,expectedEmail:string,keys:JWTVerifyGetKey|CryptoKey|Uint8Array=googleKeys){
 const {payload}=await jwtVerify(token,keys as JWTVerifyGetKey,{issuer:['https://accounts.google.com','accounts.google.com'],audience:clientId,algorithms:['RS256'],clockTolerance:30,maxTokenAge:'10m'});
 const email=normalizeGmail(payload.email);
 if(!email||email!==expectedEmail||payload.email_verified!==true||payload.nonce!==nonce||typeof payload.sub!=='string'||!payload.sub||payload.sub.length>255||(payload.azp&&payload.azp!==clientId))throw Error('Google identity could not be verified');
 const name=typeof payload.name==='string'?payload.name.trim().slice(0,80):email.split('@')[0];
 return {userId:'google:'+payload.sub,email,displayName:name||email.split('@')[0]};
}
