import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import pg from 'pg';
import type { LightMyRequestResponse } from 'fastify';
import { buildApp } from '../src/app.js';
import { PostgresStore } from '../src/postgres-store.js';
import { seedSyntheticStaff } from '../src/staff-fixtures.js';

// Explicit opt-in; each run owns a new schema and never touches application tables.
test('PostgreSQL migrations, durable private/staff sessions and access boundaries',
 {skip:!process.env.TEST_DATABASE_URL},async()=>{
 const schema=`sc_test_${randomUUID().replaceAll('-','')}`;
 const admin=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL});
 const url=new URL(process.env.TEST_DATABASE_URL!);
 url.searchParams.set('options',`-c search_path=${schema}`);
 const origin='http://localhost:3000',password='Synthetic integration password only';
 let clock=Date.now();
 const open=()=>buildApp({store:new PostgresStore(url.toString()),origin,encryptionKey:'11'.repeat(32),hashKey:'22'.repeat(32),now:()=>clock});
 let app:Awaited<ReturnType<typeof buildApp>>|undefined;
 await admin.query(`CREATE SCHEMA ${schema}`);
 try{
  const migrate=()=>promisify(execFile)(process.execPath,['--import','tsx','src/migrate.ts'],{env:{...process.env,DATABASE_URL:url.toString()}});
  await migrate();await migrate(); // Verify the real migration runner is idempotent.
  const store=new PostgresStore(url.toString());
  try{
   await seedSyntheticStaff(store,{NODE_ENV:'development',SYNTHETIC_STAFF_FIXTURES:'true',SYNTHETIC_STAFF_PASSWORD:password});
   assert.equal((await store.pool.query('SELECT count(*) FROM schema_migrations')).rows[0].count,'2');
   await assert.rejects(store.pool.query("INSERT INTO staff_identities (id,username,password_hash,role) VALUES ($1,'synthetic.bad','invalid','visitor')",[randomUUID()]));
  }finally{await store.close();}
  app=await open();
  const access=await app.inject({method:'POST',url:'/v1/access',headers:{origin},payload:{ageBand:'under18',confidentialityAcknowledged:true}});
  assert.equal(access.statusCode,201);
  const visitorCookie=String(access.headers['set-cookie']).split(';')[0];
  const visitorHeaders={origin,cookie:visitorCookie,'x-csrf-token':access.json().csrfToken};
  const request=await app.inject({method:'POST',url:'/v1/requests',headers:visitorHeaders,payload:{helpType:'talk',details:'Synthetic PostgreSQL test detail',confidentialityAcknowledged:true}});
  assert.equal(request.statusCode,201);assert.equal(request.json().route,'safeguarding');
  const application=await app.inject({method:'POST',url:'/v1/professional-applications',headers:visitorHeaders,payload:{professionalRole:'lawyer',jurisdiction:'India',qualifications:'Synthetic qualification',conductAccepted:true}});
  assert.equal(application.statusCode,201);assert.equal(application.json().status,'pending_verification');
  assert.equal((await app.inject({url:'/v1/staff/me',headers:visitorHeaders})).statusCode,401);
  const sessions:{role:string;cookie:string;csrf:string}[]=[];
  for(const role of ['verification_reviewer','safeguarding_lead','administrator']){
   const login:LightMyRequestResponse=await app.inject({method:'POST',url:'/v1/staff/login',headers:{origin},payload:{username:`synthetic.${role}`,password}});
   assert.equal(login.statusCode,200);
   sessions.push({role,cookie:String(login.headers['set-cookie']).split(';')[0],csrf:login.json().csrfToken});
  }
  await app.close();app=await open(); // Recreate process-owned state, retaining only PostgreSQL.
  assert.equal((await app.inject({url:'/v1/requests',headers:visitorHeaders})).json().requests[0].details,'Synthetic PostgreSQL test detail');
  const other=await app.inject({method:'POST',url:'/v1/access',headers:{origin},payload:{ageBand:'adult',confidentialityAcknowledged:true}});
  assert.equal((await app.inject({url:`/v1/requests/${request.json().id}`,headers:{cookie:String(other.headers['set-cookie']).split(';')[0]}})).statusCode,404);
  for(const session of sessions){
   assert.equal((await app.inject({url:'/v1/staff/me',headers:{cookie:session.cookie}})).statusCode,200);
   for(const role of ['verification_reviewer','safeguarding_lead','administrator'])assert.equal((await app.inject({url:`/v1/staff/workspace/${role}`,headers:{cookie:session.cookie}})).statusCode,role===session.role?200:403);
  }
  const reviewer=sessions[0];
  assert.equal((await app.inject({method:'POST',url:'/v1/staff/logout',headers:{origin,cookie:reviewer.cookie}})).statusCode,403);
  assert.equal((await app.inject({method:'POST',url:'/v1/staff/logout',headers:{origin,cookie:reviewer.cookie,'x-csrf-token':reviewer.csrf}})).statusCode,200);
  assert.equal((await app.inject({url:'/v1/staff/me',headers:{cookie:reviewer.cookie}})).statusCode,401);
  await admin.query(`UPDATE ${schema}.staff_identities SET active=false WHERE role='safeguarding_lead'`);
  assert.equal((await app.inject({url:'/v1/staff/me',headers:{cookie:sessions[1].cookie}})).statusCode,401);
  clock+=30*60*1000;
  assert.equal((await app.inject({url:'/v1/staff/me',headers:{cookie:sessions[2].cookie}})).statusCode,401);
  assert.equal((await app.inject({url:'/v1/me',headers:visitorHeaders})).statusCode,401);
 }finally{
  if(app)await app.close();
  // schema is generated locally above from a UUID; no user-controlled SQL identifier.
  await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();
 }
});
