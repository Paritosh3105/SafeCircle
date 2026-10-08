import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
const derive=(password:string,salt:string)=>new Promise<Buffer>((resolve,reject)=>scrypt(password,salt,64,{N:32768,r:8,p:3,maxmem:64*1024*1024},(error,key)=>error?reject(error):resolve(key)));
export const staffRoleSchema=z.enum(['verification_reviewer','safeguarding_lead','administrator']);
export type StaffRole=z.infer<typeof staffRoleSchema>;
export const staffLoginSchema=z.object({username:z.string().regex(/^[a-z0-9._-]{3,80}$/),password:z.string().min(1).max(256)}).strict();
export async function hashPassword(password:string){
 if(password.length<16||password.length>256)throw new Error('Staff passwords must contain 16–256 characters.');
 const salt=randomBytes(16).toString('hex');
 const key=await derive(password,salt);
 return `scrypt$32768$8$3$${salt}$${key.toString('hex')}`;
}
export async function verifyPassword(password:string,hash:string){
 const parts=hash.split('$');
 if(parts.length!==6||parts.slice(0,4).join('$')!=='scrypt$32768$8$3'||!/^[a-f0-9]{32}$/.test(parts[4])||!/^[a-f0-9]{128}$/.test(parts[5]))return false;
 const key=await derive(password,parts[4]);
 return timingSafeEqual(key,Buffer.from(parts[5],'hex'));
}
