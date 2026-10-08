import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { buildApp } from '../src/app.js';
import { MemoryStore } from '../src/store.js';
import { hashPassword, verifyPassword } from '../src/staff-password.js';
import { seedSyntheticStaff } from '../src/staff-fixtures.js';
const origin='http://localhost:3000',password='Synthetic password for tests only';
async function fixture(production=false){
 let clock=Date.now();const store=new MemoryStore();
 const hash=await hashPassword(password);
 for(const role of ['verification_reviewer','safeguarding_lead','administrator'] as const)await store.createStaff({id:randomUUID(),username:role,passwordHash:hash,role,active:true});
 const app=await buildApp({store,origin,encryptionKey:'11'.repeat(32),hashKey:'22'.repeat(32),now:()=>clock,production});
 return{app,store,tick:()=>{clock+=30*60*1000;}};
}
test('ordinary users and pending applicants cannot enter staff or self-provision',async()=>{
 const {app,store}=await fixture();try{
 const access=await app.inject({method:'POST',url:'/v1/access',headers:{origin},payload:{ageBand:'adult',confidentialityAcknowledged:true}});
 const cookie=String(access.headers['set-cookie']).split(';')[0],headers={origin,cookie,'x-csrf-token':access.json().csrfToken};
 for(const pending of [false,true]){
  if(pending)assert.equal((await app.inject({method:'POST',url:'/v1/professional-applications',headers,payload:{professionalRole:'lawyer',jurisdiction:'India',qualifications:'Synthetic qualification',conductAccepted:true}})).statusCode,201);
  for(const path of ['me','workspace/verification_reviewer','workspace/safeguarding_lead','workspace/administrator'])assert.equal((await app.inject({url:`/v1/staff/${path}`,headers})).statusCode,401);
  for(const path of ['register','provision','roles'])assert.equal((await app.inject({method:'POST',url:`/v1/staff/${path}`,headers,payload:{role:'administrator'}})).statusCode,404);
 }
 assert.equal((await app.inject({method:'POST',url:'/v1/staff/login',headers,payload:{username:'administrator',password,role:'administrator'}})).statusCode,400);
 assert.equal(store.staff.size,3);
 // Relabelling an ordinary cookie cannot cross the separate credential namespace.
 assert.equal((await app.inject({url:'/v1/staff/me',headers:{cookie:cookie.replace('sc_session=','sc_staff_session=')}})).statusCode,401);
 }finally{await app.close();}
});
test('staff role matrix, session isolation, CSRF, logout, expiry and deactivation',async()=>{
 const {app,store,tick}=await fixture();try{
 for(const role of ['verification_reviewer','safeguarding_lead','administrator']){
  const login=await app.inject({method:'POST',url:'/v1/staff/login',headers:{origin},payload:{username:role,password}});assert.equal(login.statusCode,200);
  const cookie=String(login.headers['set-cookie']).split(';')[0],headers={origin,cookie,'x-csrf-token':login.json().csrfToken};
  assert.match(String(login.headers['set-cookie']),/HttpOnly/);assert.match(String(login.headers['set-cookie']),/SameSite=Strict/);
  assert.equal((await app.inject({url:'/v1/me',headers:{cookie}})).statusCode,401);
  assert.equal((await app.inject({url:'/v1/staff/me',headers:{cookie}})).json().staff.passwordHash,undefined);
  for(const target of ['verification_reviewer','safeguarding_lead','administrator'])assert.equal((await app.inject({url:`/v1/staff/workspace/${target}`,headers})).statusCode,target===role?200:403);
  assert.equal((await app.inject({method:'POST',url:'/v1/staff/logout',headers:{origin,cookie}})).statusCode,403);
  assert.equal((await app.inject({method:'POST',url:'/v1/staff/logout',headers:{...headers,origin:'https://evil.invalid'}})).statusCode,403);
  assert.equal((await app.inject({method:'POST',url:'/v1/staff/logout',headers})).statusCode,200);
  assert.equal((await app.inject({url:'/v1/staff/me',headers:{cookie}})).statusCode,401);
 }
 for(const deactivate of [true,false]){
  const r=await app.inject({method:'POST',url:'/v1/staff/login',headers:{origin},payload:{username:'administrator',password}});
  const cookie=String(r.headers['set-cookie']).split(';')[0];assert.equal(r.statusCode,200);
  if(deactivate){const staff=await store.findStaff('administrator');staff!.active=false;}else tick();
  assert.equal((await app.inject({url:'/v1/staff/me',headers:{cookie}})).statusCode,401);
  (await store.findStaff('administrator'))!.active=true;
 }
 assert.equal(store.staffSessions.size,0);
 }finally{await app.close();}
});
test('password hashes are salted, fixtures reject non-development, login is origin checked and throttled',async()=>{
 const hash=await hashPassword(password);assert.notEqual(hash,await hashPassword(password));assert.equal(await verifyPassword(password,hash),true);assert.equal(await verifyPassword('wrong',hash),false);await assert.rejects(hashPassword('short'));
 await assert.rejects(seedSyntheticStaff(new MemoryStore(),{NODE_ENV:'production',SYNTHETIC_STAFF_FIXTURES:'true',SYNTHETIC_STAFF_PASSWORD:password}));
 const {app}=await fixture(true);try{
 const payload={username:'administrator',password};
 assert.equal((await app.inject({method:'POST',url:'/v1/staff/login',payload})).statusCode,403);
 const good=await app.inject({method:'POST',url:'/v1/staff/login',headers:{origin},payload});assert.match(String(good.headers['set-cookie']),/__Host-sc_staff_session=.*Secure/);
 for(let i=0;i<4;i++)assert.equal((await app.inject({method:'POST',url:'/v1/staff/login',headers:{origin},payload:{username:'unknown',password:'wrong'}})).statusCode,401);
 assert.equal((await app.inject({method:'POST',url:'/v1/staff/login',headers:{origin},payload})).statusCode,429);
 }finally{await app.close();}
});
