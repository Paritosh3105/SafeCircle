import type { StaffRole } from './staff-password.js';
export interface StaffIdentity { id:string; username:string; passwordHash:string; role:StaffRole; active:boolean; }
export interface StaffSession { hash:string; staffId:string; csrfToken:string; expiresAt:string; }
export interface StaffStore {
 createStaff(row:StaffIdentity):Promise<void>;
 findStaff(username:string):Promise<StaffIdentity|undefined>;
 getStaff(id:string):Promise<StaffIdentity|undefined>;
 saveStaffSession(row:StaffSession):Promise<void>;
 getStaffSession(hash:string):Promise<StaffSession|undefined>;
 deleteStaffSession(hash:string):Promise<void>;
}
