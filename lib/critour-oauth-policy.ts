import {jwtVerify,createRemoteJWKSet,type JWTVerifyGetKey} from 'jose';
const googleKeys=createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
export type OAuthProvider='google'|'github';
export type OAuthIdentity={provider:OAuthProvider;subject:string;displayName:string};
export function oauthProvider(v:string):v is OAuthProvider{return v==='google'||v==='github';}
export function safeReturn(value:unknown){
 if(typeof value!=='string'||value.length>500)return '/codemate';
 // Only known application routes; no arbitrary relative redirects or encoded separators.
 if(/^\/p\/[a-f0-9-]{36}(?:\?via=share)?$/.test(value))return value;
 if(['/codemate','/codemate/profile','/codemate/create','/codemate/discover'].includes(value))return value;
 if(/^\/codemate\/discover\?listing=[a-f0-9-]{36}$/.test(value))return value;
 return '/codemate';
}
export async function verifyCritourGoogle(token:string,clientId:string,nonce:string,keys:JWTVerifyGetKey|CryptoKey|Uint8Array=googleKeys):Promise<OAuthIdentity>{
 const {payload}=await jwtVerify(token,keys as JWTVerifyGetKey,{issuer:['https://accounts.google.com','accounts.google.com'],audience:clientId,algorithms:['RS256'],clockTolerance:30,maxTokenAge:'10m',requiredClaims:['sub','iat','exp','nonce','email','email_verified']});
 if(typeof payload.sub!=='string'||!payload.sub||payload.sub.length>255||payload.nonce!==nonce||payload.email_verified!==true||typeof payload.email!=='string'||payload.email.length>254||!/^\S+@\S+\.\S+$/.test(payload.email)||(payload.azp&&payload.azp!==clientId))throw Error('Google identity verification failed');
 return {provider:'google',subject:payload.sub,displayName:typeof payload.name==='string'&&payload.name.trim()?payload.name.trim().slice(0,80):'New creator'};
}
export function githubIdentity(value:unknown):OAuthIdentity{
 const v=value as Record<string,unknown>;if(!v||typeof v.id!=='number'||!Number.isSafeInteger(v.id)||v.id<1||typeof v.login!=='string'||!v.login||v.login.length>100)throw Error('GitHub identity verification failed');
 return {provider:'github',subject:String(v.id),displayName:typeof v.name==='string'&&v.name.trim()?v.name.trim().slice(0,80):v.login.slice(0,80)};
}
export function validGithubToken(value:unknown){
 const v=value as Record<string,unknown>;
 // An identity-only app must never silently inherit previously authorized repo scopes.
 if(!v||typeof v.access_token!=='string'||v.access_token.length>2048||!v.access_token||typeof v.token_type!=='string'||v.token_type.toLowerCase()!=='bearer'||typeof v.scope!=='string'||v.scope.trim()!=='')throw Error('GitHub returned unexpected permissions');
 return v.access_token;
}
