import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { timingSafeEqual } from 'node:crypto';
import { createCrypto, secret } from './crypto.js';
import { hashPassword, verifyPassword, staffLoginSchema, type StaffRole } from './staff-password.js';
import type { AppOptions } from './app.js';
export async function registerStaffRoutes(app:FastifyInstance,options:AppOptions){
 const store=options.store, crypto=createCrypto(options.encryptionKey,options.hashKey), now=options.now??Date.now;
 const cookie=options.production?'__Host-sc_staff_session':'sc_staff_session';
 const ttl=30*60*1000;
 const cookieOptions={path:'/',httpOnly:true,secure:!!options.production,sameSite:'strict' as const,maxAge:ttl/1000};
 const dummy=await hashPassword(secret());
 const fail=(reply:FastifyReply,status:number,message:string)=>reply.code(status).send({error:message});
 async function authenticate(req:FastifyRequest,reply:FastifyReply,role?:StaffRole){
  const token=req.cookies[cookie];const session=token?await store.getStaffSession(crypto.hash(`staff:${token}`)):undefined;
  const staff=session?await store.getStaff(session.staffId):undefined;
  if(!session||Date.parse(session.expiresAt)<=now()||!staff?.active){
   if(session)await store.deleteStaffSession(session.hash);
   reply.clearCookie(cookie,{path:'/'});fail(reply,401,'Staff login required.');return;
  }
  if(!['GET','HEAD'].includes(req.method)){
   const supplied=req.headers['x-csrf-token'];
   if(typeof supplied!=='string'||!/^[a-f0-9]{64}$/.test(supplied)||!timingSafeEqual(Buffer.from(supplied),Buffer.from(session.csrfToken))){fail(reply,403,'Staff CSRF token required.');return;}
  }
  if(role&&staff.role!==role){fail(reply,403,'This staff role cannot access this workspace.');return;}
  return {staff,session};
 }
 app.post('/v1/staff/login',{config:{rateLimit:{max:5,timeWindow:'1 minute'}}},async(req,reply)=>{
  const parsed=staffLoginSchema.safeParse(req.body);if(!parsed.success)return fail(reply,400,'Invalid staff login fields.');
  const staff=await store.findStaff(parsed.data.username);
  const valid=await verifyPassword(parsed.data.password,staff?.passwordHash??dummy);
  if(!valid||!staff?.active)return fail(reply,401,'Staff credentials not recognised.');
  const previous=req.cookies[cookie];if(previous)await store.deleteStaffSession(crypto.hash(`staff:${previous}`));
  const token=secret();const session={hash:crypto.hash(`staff:${token}`),staffId:staff.id,csrfToken:secret(),expiresAt:new Date(now()+ttl).toISOString()};
  await store.saveStaffSession(session);reply.setCookie(cookie,token,cookieOptions);
  return {staff:{id:staff.id,username:staff.username,role:staff.role},csrfToken:session.csrfToken,expiresAt:session.expiresAt};
 });
 app.get('/v1/staff/me',async(req,reply)=>{const auth=await authenticate(req,reply);if(!auth)return;return{staff:{id:auth.staff.id,username:auth.staff.username,role:auth.staff.role},csrfToken:auth.session.csrfToken,expiresAt:auth.session.expiresAt};});
 app.post('/v1/staff/logout',async(req,reply)=>{const auth=await authenticate(req,reply);if(!auth)return;await store.deleteStaffSession(auth.session.hash);reply.clearCookie(cookie,{path:'/'});return{ok:true};});
 for(const role of ['verification_reviewer','safeguarding_lead','administrator'] as const){
  app.get(`/v1/staff/workspace/${role}`,async(req,reply)=>{const auth=await authenticate(req,reply,role);if(!auth)return;return{role:auth.staff.role,syntheticOnly:true,message:'Staff authentication workspace. Review, assignment and messaging are not enabled.'};});
 }
}
