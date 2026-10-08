import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { accessSchema, recoverySchema, requestSchema, applicationSchema, type RequestView } from '@safecircle/contracts';
import { createCrypto, secret } from './crypto.js';
import { registerStaffRoutes } from './staff-routes.js';
import type { AccountRow, SessionRow, Store, RequestRow } from './store.js';
export interface AppOptions { store:Store; encryptionKey:string; hashKey:string; origin:string; production?:boolean; now?:()=>number; sessionMinutes?:number; }
const COOKIE='sc_session';
export async function buildApp(options:AppOptions){
 const app=Fastify({logger:false,bodyLimit:16*1024,trustProxy:false});const store=options.store;
 const crypto=createCrypto(options.encryptionKey,options.hashKey);const now=options.now??Date.now;
 const ttl=(options.sessionMinutes??30)*60*1000;
 await app.register(cookie);await app.register(helmet,{contentSecurityPolicy:false});
 await app.register(rateLimit,{max:120,timeWindow:'1 minute'});
 const cookieOptions={httpOnly:true,secure:!!options.production,sameSite:'strict' as const,path:'/',maxAge:ttl/1000};
 function fail(reply:FastifyReply,status:number,message:string){return reply.code(status).send({error:message});}
 app.addHook('onRequest',async(req,reply)=>{
  reply.header('Cache-Control','no-store').header('Referrer-Policy','no-referrer');
  if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.headers.origin!==options.origin)return fail(reply,403,'This action must come from the configured application origin.');
 });
 app.setErrorHandler((error,req,reply)=>{
  const status=(error as {statusCode?:number}).statusCode;
  // Never return user input, encryption internals, SQL or stack traces.
  if(status&&status>=400&&status<500)return fail(reply,status,status===429?'Please wait before trying again.':'Invalid request.');
  return fail(reply,500,'The request could not be completed. Please try again.');
 });
 function newSession(accountId:string){const token=secret();const row:SessionRow={hash:crypto.hash(token),accountId,csrfToken:secret(),expiresAt:new Date(now()+ttl).toISOString()};return {token,row};}
 function accountView(a:AccountRow){const {recoveryHash,...view}=a;return view;}
 async function authenticate(req:FastifyRequest,reply:FastifyReply):Promise<{session:SessionRow;account:AccountRow}|undefined>{
  const token=req.cookies[COOKIE];const row=token?await store.getSession(crypto.hash(token)):undefined;
  if(!row||Date.parse(row.expiresAt)<=now()){if(row)await store.deleteSession(row.hash);reply.clearCookie(COOKIE,{path:'/'});fail(reply,401,'Private session locked. Use your recovery code to return.');return;}
  const account=await store.getAccount(row.accountId);if(!account){fail(reply,401,'Private session unavailable.');return;}
  if(!['GET','HEAD'].includes(req.method)){
   const supplied=req.headers['x-csrf-token'];
   if(typeof supplied!=='string'||!/^[a-f0-9]{64}$/.test(supplied)||Buffer.byteLength(supplied)!==Buffer.byteLength(row.csrfToken)||!timingSafeEqual(Buffer.from(supplied),Buffer.from(row.csrfToken))){fail(reply,403,'Refresh the session before trying this action.');return;}
  }
  return {session:row,account};
 }
 function requestView(row:RequestRow):RequestView{const {accountId,detailsEncrypted,...view}=row;return {...view,details:crypto.open(detailsEncrypted,`request:${row.id}:${accountId}`)};}
 function event(actorId:string,action:string,targetId:string){return{actorId,action,targetId,createdAt:new Date(now()).toISOString()};}
 app.get('/v1/health',async()=>({ok:true,apiVersion:'v1'}));
 app.get('/v1/availability',async()=>({mode:'development',staffed:false,professionalGuidanceAvailable:false,acceptsRealCases:false,initialSupportFree:true,message:'Development build. No caseworkers, clinicians or lawyers are connected. Use synthetic information only.'}));
 app.post('/v1/access',{config:{rateLimit:{max:10,timeWindow:'1 minute'}}},async(req,reply)=>{
  const parsed=accessSchema.safeParse(req.body);if(!parsed.success)return fail(reply,400,'Choose an age pathway and acknowledge the confidentiality information.');
  const id=randomUUID();const recoveryCode=secret();const a:AccountRow={id,pseudonym:`Visitor ${secret().slice(0,6)}`,ageBand:parsed.data.ageBand,jurisdiction:parsed.data.jurisdiction,recoveryHash:crypto.hash(recoveryCode),notificationsEnabled:false,outsideContactAllowed:false};
  const s=newSession(id);await store.createAccount(a,s.row);reply.setCookie(COOKIE,s.token,cookieOptions);reply.code(201);
  return{account:accountView(a),csrfToken:s.row.csrfToken,expiresAt:s.row.expiresAt,recoveryCode};
 });
 app.post('/v1/access/recover',{config:{rateLimit:{max:5,timeWindow:'1 minute'}}},async(req,reply)=>{
  const parsed=recoverySchema.safeParse(req.body);if(!parsed.success)return fail(reply,401,'Recovery code not recognised.');
  const a=await store.findAccountByRecovery(crypto.hash(parsed.data.recoveryCode));if(!a)return fail(reply,401,'Recovery code not recognised.');
  const s=newSession(a.id);await store.replaceSessions(a.id,s.row);reply.setCookie(COOKIE,s.token,cookieOptions);return{account:accountView(a),csrfToken:s.row.csrfToken,expiresAt:s.row.expiresAt};
 });
 app.get('/v1/me',async(req,reply)=>{const auth=await authenticate(req,reply);if(!auth)return;return{account:accountView(auth.account),csrfToken:auth.session.csrfToken,expiresAt:auth.session.expiresAt};});
 app.post('/v1/access/logout',async(req,reply)=>{const auth=await authenticate(req,reply);if(!auth)return;await store.deleteSession(auth.session.hash);reply.clearCookie(COOKIE,{path:'/'});return{ok:true};});
 app.post('/v1/requests',async(req,reply)=>{
  const auth=await authenticate(req,reply);if(!auth)return;
  const parsed=requestSchema.safeParse(req.body);if(!parsed.success)return fail(reply,400,'Check the help type, details length and confidentiality acknowledgement.');
  if((await store.listRequests(auth.account.id)).length>=50)return fail(reply,429,'Development request limit reached.');
  const id=randomUUID();const a=auth.account;const route=a.ageBand==='under18'?'safeguarding':a.ageBand==='undisclosed'?'eligibility_review':'adult';
  const row:RequestRow={id,accountId:a.id,reference:`SC-${id}`,helpType:parsed.data.helpType,detailsEncrypted:crypto.seal(parsed.data.details,`request:${id}:${a.id}`),status:'received',route,createdAt:new Date(now()).toISOString()};
  await store.saveRequest(row,event(a.id,'request.created',id));reply.code(201);return requestView(row);
 });
 app.get('/v1/requests',async(req,reply)=>{const auth=await authenticate(req,reply);if(!auth)return;return{requests:(await store.listRequests(auth.account.id)).map(requestView)};});
 app.get<{Params:{id:string}}>('/v1/requests/:id',async(req,reply)=>{const auth=await authenticate(req,reply);if(!auth)return;if(!/^[a-f0-9-]{36}$/i.test(req.params.id))return fail(reply,404,'Request not found.');const row=await store.getRequest(req.params.id);if(!row||row.accountId!==auth.account.id)return fail(reply,404,'Request not found.');return requestView(row);});
 app.post<{Params:{id:string}}>('/v1/requests/:id/pause',async(req,reply)=>{const auth=await authenticate(req,reply);if(!auth)return;if(!/^[a-f0-9-]{36}$/i.test(req.params.id))return fail(reply,404,'Request not found.');const row=await store.pauseRequest(req.params.id,auth.account.id,event(auth.account.id,'request.paused',req.params.id));if(!row)return fail(reply,404,'Request not found.');return{ok:true};});
 app.post('/v1/professional-applications',async(req,reply)=>{
  const auth=await authenticate(req,reply);if(!auth)return;
  const parsed=applicationSchema.safeParse(req.body);if(!parsed.success)return fail(reply,400,'Check the professional application fields.');
  if((await store.listApplications(auth.account.id)).length>=5)return fail(reply,429,'Development application limit reached.');
  const id=randomUUID();const row={id,accountId:auth.account.id,professionalRole:parsed.data.professionalRole,status:'pending_verification' as const,createdAt:new Date(now()).toISOString(),evidenceEncrypted:crypto.seal(JSON.stringify(parsed.data),`application:${id}:${auth.account.id}`)};
  await store.saveApplication(row,event(auth.account.id,'application.submitted',id));reply.code(201);const {accountId,evidenceEncrypted,...view}=row;return view;
 });
 app.get('/v1/professional-applications',async(req,reply)=>{const auth=await authenticate(req,reply);if(!auth)return;return{applications:(await store.listApplications(auth.account.id)).map(({accountId,evidenceEncrypted,...view})=>view)};});
 // Step 1 has no staff verification, assignment or clinical service privileges.
 app.get('/v1/professional/assigned-requests',async(req,reply)=>{const auth=await authenticate(req,reply);if(!auth)return;return fail(reply,403,'Professional access requires current approval, verified scope and a case assignment.');});
 await registerStaffRoutes(app,options);
 app.addHook('onClose',async()=>{await store.close();});return app;
}
