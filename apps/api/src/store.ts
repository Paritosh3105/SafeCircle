import type { AccountView, ApplicationView, RequestView } from '@safecircle/contracts';
import type { StaffStore, StaffIdentity, StaffSession } from './staff-store.js';
export interface AccountRow extends AccountView { recoveryHash:string; }
export interface SessionRow { hash:string; accountId:string; csrfToken:string; expiresAt:string; }
export interface RequestRow extends Omit<RequestView,'details'> { accountId:string; detailsEncrypted:string; }
export interface ApplicationRow extends ApplicationView { accountId:string; evidenceEncrypted:string; }
export interface AuditEvent { actorId:string; action:string; targetId:string; createdAt:string; }
export interface Store extends StaffStore {
  createAccount(account:AccountRow,session:SessionRow):Promise<void>;
  findAccountByRecovery(hash:string):Promise<AccountRow|undefined>;
  getAccount(id:string):Promise<AccountRow|undefined>;
  getSession(hash:string):Promise<SessionRow|undefined>;
  replaceSessions(accountId:string,session:SessionRow):Promise<void>;
  deleteSession(hash:string):Promise<void>;
  saveRequest(row:RequestRow,event:AuditEvent):Promise<void>;
  listRequests(accountId:string):Promise<RequestRow[]>;
  getRequest(id:string):Promise<RequestRow|undefined>;
  pauseRequest(id:string,accountId:string,event:AuditEvent):Promise<boolean>;
  saveApplication(row:ApplicationRow,event:AuditEvent):Promise<void>;
  listApplications(accountId:string):Promise<ApplicationRow[]>;
  close():Promise<void>;
}
// Non-durable development adapter. Never enabled by production configuration.
export class MemoryStore implements Store {
  staff=new Map<string,StaffIdentity>(); staffSessions=new Map<string,StaffSession>();
  async createStaff(row:StaffIdentity){if([...this.staff.values()].some(s=>s.username===row.username))throw new Error('Staff username already exists');this.staff.set(row.id,row);}
  async findStaff(username:string){return [...this.staff.values()].find(s=>s.username===username);}
  async getStaff(id:string){return this.staff.get(id);}
  async saveStaffSession(row:StaffSession){this.staffSessions.set(row.hash,row);}
  async getStaffSession(hash:string){return this.staffSessions.get(hash);}
  async deleteStaffSession(hash:string){this.staffSessions.delete(hash);}
  accounts=new Map<string,AccountRow>(); sessions=new Map<string,SessionRow>(); requests=new Map<string,RequestRow>(); applications=new Map<string,ApplicationRow>(); audit:AuditEvent[]=[];
  async createAccount(a:AccountRow,s:SessionRow){this.accounts.set(a.id,a);this.sessions.set(s.hash,s);}
  async findAccountByRecovery(h:string){return [...this.accounts.values()].find(a=>a.recoveryHash===h);}
  async getAccount(id:string){return this.accounts.get(id);}
  async getSession(h:string){return this.sessions.get(h);}
  async replaceSessions(id:string,s:SessionRow){for(const [h,row] of this.sessions)if(row.accountId===id)this.sessions.delete(h);this.sessions.set(s.hash,s);}
  async deleteSession(h:string){this.sessions.delete(h);}
  async saveRequest(r:RequestRow,e:AuditEvent){this.requests.set(r.id,r);this.audit.push(e);}
  async listRequests(id:string){return [...this.requests.values()].filter(r=>r.accountId===id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));}
  async getRequest(id:string){return this.requests.get(id);}
  async pauseRequest(id:string,owner:string,e:AuditEvent){const row=this.requests.get(id);if(!row||row.accountId!==owner)return false;this.requests.set(id,{...row,status:'paused'});this.audit.push(e);return true;}
  async saveApplication(r:ApplicationRow,e:AuditEvent){this.applications.set(r.id,r);this.audit.push(e);}
  async listApplications(id:string){return [...this.applications.values()].filter(r=>r.accountId===id);}
  async close(){}
}
