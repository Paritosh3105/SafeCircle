import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { MemoryStore } from '../src/store.js';
import { createCrypto } from '../src/crypto.js';
import { readConfig } from '../src/config.js';
const origin='http://localhost:3000';
async function fixture(){let clock=Date.now();const store=new MemoryStore();const app=await buildApp({store,encryptionKey:'11'.repeat(32),hashKey:'22'.repeat(32),origin,now:()=>clock});return{app,store,tick:()=>{clock+=31*60*1000;}};}
async function access(app:Awaited<ReturnType<typeof buildApp>>,ageBand='adult'){
 const r=await app.inject({method:'POST',url:'/v1/access',headers:{origin},payload:{ageBand,confidentialityAcknowledged:true}});assert.equal(r.statusCode,201);
 const cookie=String(r.headers['set-cookie']).split(';')[0];const data=r.json();return{cookie,data,headers:{origin,cookie,'x-csrf-token':data.csrfToken}};
}
test('private session defaults, encryption, own request and cross-account isolation',async()=>{
 const {app,store}=await fixture();try{
  const a=await access(app);const b=await access(app);
  assert.equal(a.data.account.notificationsEnabled,false);assert.equal(a.data.account.outsideContactAllowed,false);
  assert.equal(store.accounts.get(a.data.account.id)?.recoveryHash.includes(a.data.recoveryCode),false);
  const r=await app.inject({method:'POST',url:'/v1/requests',headers:a.headers,payload:{helpType:'legal',details:'Synthetic confidential detail',confidentialityAcknowledged:true}});assert.equal(r.statusCode,201);
  const row=r.json();assert.equal(row.details,'Synthetic confidential detail');assert.equal(store.requests.get(row.id)?.detailsEncrypted.includes('Synthetic'),false);
  assert.equal((await app.inject({url:`/v1/requests/${row.id}`,headers:{cookie:b.cookie}})).statusCode,404);
  assert.equal((await app.inject({url:'/v1/requests',headers:{cookie:b.cookie}})).json().requests.length,0);
  assert.equal((await app.inject({method:'POST',url:`/v1/requests/${row.id}/pause`,headers:b.headers})).statusCode,404);
  assert.equal((await app.inject({url:'/v1/requests'})).statusCode,401);
 }finally{await app.close();}
});
test('origin, CSRF and strict registration schema prevent privilege escalation',async()=>{
 const {app}=await fixture();try{
  assert.equal((await app.inject({method:'POST',url:'/v1/access',headers:{origin:'https://attacker.invalid'},payload:{ageBand:'adult',confidentialityAcknowledged:true}})).statusCode,403);
  assert.equal((await app.inject({method:'POST',url:'/v1/access',headers:{origin},payload:{ageBand:'adult',confidentialityAcknowledged:true,role:'admin'}})).statusCode,400);
  const a=await access(app);
  assert.equal((await app.inject({method:'POST',url:'/v1/requests',headers:{origin,cookie:a.cookie},payload:{helpType:'talk',confidentialityAcknowledged:true}})).statusCode,403);
  const r=await app.inject({method:'POST',url:'/v1/professional-applications',headers:a.headers,payload:{professionalRole:'lawyer',jurisdiction:'India',qualifications:'Synthetic claimed qualification',conductAccepted:true}});
  assert.equal(r.statusCode,201);assert.equal(r.json().status,'pending_verification');
  assert.equal((await app.inject({url:'/v1/professional/assigned-requests',headers:{cookie:a.cookie}})).statusCode,403);
 }finally{await app.close();}
});
test('minor and undisclosed age routes stay distinct',async()=>{
 const {app}=await fixture();try{
  for(const [age,expected] of [['under18','safeguarding'],['undisclosed','eligibility_review']]){
   const a=await access(app,age);const r=await app.inject({method:'POST',url:'/v1/requests',headers:a.headers,payload:{helpType:'talk',confidentialityAcknowledged:true}});assert.equal(r.json().route,expected);
  }
 }finally{await app.close();}
});
test('recovery invalidates previous sessions, logout and expiry lock access',async()=>{
 const {app,tick}=await fixture();try{
  const a=await access(app);const recovered=await app.inject({method:'POST',url:'/v1/access/recover',headers:{origin},payload:{recoveryCode:a.data.recoveryCode}});assert.equal(recovered.statusCode,200);
  assert.equal((await app.inject({url:'/v1/me',headers:{cookie:a.cookie}})).statusCode,401);
  const cookie=String(recovered.headers['set-cookie']).split(';')[0];
  assert.equal((await app.inject({method:'POST',url:'/v1/access/logout',headers:{origin,cookie,'x-csrf-token':recovered.json().csrfToken}})).statusCode,200);
  assert.equal((await app.inject({url:'/v1/me',headers:{cookie}})).statusCode,401);
  const b=await access(app);tick();assert.equal((await app.inject({url:'/v1/me',headers:{cookie:b.cookie}})).statusCode,401);
 }finally{await app.close();}
});
test('encryption binds ciphertext to record context and production forbids memory mode',()=>{
 const c=createCrypto('11'.repeat(32),'22'.repeat(32));const value=c.seal('Synthetic data','record-A');
 assert.equal(c.open(value,'record-A'),'Synthetic data');assert.throws(()=>c.open(value,'record-B'));
 assert.throws(()=>readConfig({NODE_ENV:'production',WEB_ORIGIN:'https://example.invalid',STORE_MODE:'memory',FIELD_ENCRYPTION_KEY:'11'.repeat(32),TOKEN_HASH_KEY:'22'.repeat(32)}));
});
