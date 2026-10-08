import { randomUUID } from 'node:crypto';
import { hashPassword, type StaffRole } from './staff-password.js';
import type { StaffStore } from './staff-store.js';
export async function seedSyntheticStaff(store:StaffStore,env:NodeJS.ProcessEnv){
 if(env.NODE_ENV!=='development'||env.SYNTHETIC_STAFF_FIXTURES!=='true')throw new Error('Synthetic staff fixtures require explicit development opt-in.');
 const password=env.SYNTHETIC_STAFF_PASSWORD;
 if(!password)throw new Error('SYNTHETIC_STAFF_PASSWORD is required');
 const passwordHash=await hashPassword(password);
 for(const role of ['verification_reviewer','safeguarding_lead','administrator'] as StaffRole[]){
  const username=`synthetic.${role}`;
  if(!await store.findStaff(username))await store.createStaff({id:randomUUID(),username,passwordHash,role,active:true});
 }
}
