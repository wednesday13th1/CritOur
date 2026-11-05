import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,SignJWT} from 'jose';
import {normalizeGmail,pkceChallenge,verifyGoogleIdentity} from '../lib/google-identity.ts';
const {privateKey,publicKey}=await generateKeyPair('RS256');
const now=Math.floor(Date.now()/1000),aud='studio.apps.googleusercontent.com';
async function signed(changes={}){return new SignJWT({iss:'https://accounts.google.com',aud,sub:'google-user',iat:now,exp:now+300,nonce:'one-time-nonce',email:'member@gmail.com',email_verified:true,name:'Member',...changes}).setProtectedHeader({alg:'RS256'}).sign(privateKey);}
test('Gmail normalization and RFC 7636 S256 challenge',async()=>{assert.equal(normalizeGmail(' Member@GMAIL.com '),'member@gmail.com');for(const value of ['x@evil.test','x@gmail.com.evil.test','x@@gmail.com','<script>@gmail.com',null])assert.equal(normalizeGmail(value),null);assert.equal(await pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'),'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');});
test('verified Google identity yields only expected Gmail and stable subject',async()=>{assert.deepEqual(await verifyGoogleIdentity(await signed(),aud,'one-time-nonce','member@gmail.com',publicKey),{userId:'google:google-user',email:'member@gmail.com',displayName:'Member'});});
test('reject invalid identity claims and expired tokens',async()=>{for(const changes of [{iss:'https://evil.test'},{aud:'other-client'},{nonce:'wrong'},{email_verified:false},{email_verified:'true'},{email:'other@gmail.com'},{sub:''},{exp:now-120},{azp:'another-client'},{iat:now-1000}])await assert.rejects(verifyGoogleIdentity(await signed(changes),aud,'one-time-nonce','member@gmail.com',publicKey));});
test('reject forged signature and unsigned tokens',async()=>{const wrong=await generateKeyPair('RS256');await assert.rejects(verifyGoogleIdentity(await signed(),aud,'one-time-nonce','member@gmail.com',wrong.publicKey));await assert.rejects(verifyGoogleIdentity('eyJhbGciOiJub25lIn0.e30.',aud,'one-time-nonce','member@gmail.com',publicKey));});
