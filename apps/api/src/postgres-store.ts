import pg from 'pg';
import type { StaffIdentity, StaffSession } from './staff-store.js';
import type { AccountRow, SessionRow, RequestRow, ApplicationRow, AuditEvent, Store } from './store.js';
export class PostgresStore implements Store {
  async createStaff(row:StaffIdentity){await this.pool.query('INSERT INTO staff_identities (id,username,password_hash,role,active) VALUES ($1,$2,$3,$4,$5)',[row.id,row.username,row.passwordHash,row.role,row.active]);}
  private mapStaff(r:any):StaffIdentity|undefined{return r?{id:r.id,username:r.username,passwordHash:r.password_hash,role:r.role,active:r.active}:undefined;}
  async findStaff(username:string){return this.mapStaff((await this.pool.query('SELECT * FROM staff_identities WHERE username=$1',[username])).rows[0]);}
  async getStaff(id:string){return this.mapStaff((await this.pool.query('SELECT * FROM staff_identities WHERE id=$1',[id])).rows[0]);}
  async saveStaffSession(row:StaffSession){await this.pool.query('INSERT INTO staff_sessions (token_hash,staff_id,csrf_token,expires_at) VALUES ($1,$2,$3,$4)',[row.hash,row.staffId,row.csrfToken,row.expiresAt]);}
  async getStaffSession(hash:string){const r=(await this.pool.query('SELECT * FROM staff_sessions WHERE token_hash=$1',[hash])).rows[0];return r?{hash:r.token_hash,staffId:r.staff_id,csrfToken:r.csrf_token,expiresAt:r.expires_at.toISOString()}:undefined;}
  async deleteStaffSession(hash:string){await this.pool.query('DELETE FROM staff_sessions WHERE token_hash=$1',[hash]);}
  pool:pg.Pool;
  constructor(url:string){this.pool=new pg.Pool({connectionString:url,max:10});}
  private async transaction(action:(client:pg.PoolClient)=>Promise<void>){const c=await this.pool.connect();try{await c.query('BEGIN');await action(c);await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
  private async session(c:pg.PoolClient,s:SessionRow){await c.query('INSERT INTO sessions (token_hash,account_id,csrf_token,expires_at) VALUES ($1,$2,$3,$4)',[s.hash,s.accountId,s.csrfToken,s.expiresAt]);}
  private async audit(c:pg.PoolClient,e:AuditEvent){await c.query('INSERT INTO audit_events (actor_id,action,target_id,created_at) VALUES ($1,$2,$3,$4)',[e.actorId,e.action,e.targetId,e.createdAt]);}
  async createAccount(a:AccountRow,s:SessionRow){await this.transaction(async c=>{await c.query('INSERT INTO accounts (id,pseudonym,age_band,jurisdiction,recovery_hash) VALUES ($1,$2,$3,$4,$5)',[a.id,a.pseudonym,a.ageBand,a.jurisdiction,a.recoveryHash]);await this.session(c,s);});}
  private mapAccount(r:any):AccountRow|undefined {return r?{id:r.id,pseudonym:r.pseudonym,ageBand:r.age_band,jurisdiction:r.jurisdiction,recoveryHash:r.recovery_hash,notificationsEnabled:false,outsideContactAllowed:false}:undefined;}
  async findAccountByRecovery(h:string){return this.mapAccount((await this.pool.query('SELECT * FROM accounts WHERE recovery_hash=$1',[h])).rows[0]);}
  async getAccount(id:string){return this.mapAccount((await this.pool.query('SELECT * FROM accounts WHERE id=$1',[id])).rows[0]);}
  async getSession(h:string){const r=(await this.pool.query('SELECT * FROM sessions WHERE token_hash=$1',[h])).rows[0];return r?{hash:r.token_hash,accountId:r.account_id,csrfToken:r.csrf_token,expiresAt:r.expires_at.toISOString()}:undefined;}
  async replaceSessions(id:string,s:SessionRow){await this.transaction(async c=>{await c.query('SELECT id FROM accounts WHERE id=$1 FOR UPDATE',[id]);await c.query('DELETE FROM sessions WHERE account_id=$1',[id]);await this.session(c,s);});}
  async deleteSession(h:string){await this.pool.query('DELETE FROM sessions WHERE token_hash=$1',[h]);}
  async saveRequest(r:RequestRow,e:AuditEvent){await this.transaction(async c=>{await c.query('INSERT INTO support_requests (id,account_id,reference,help_type,details_encrypted,status,route,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',[r.id,r.accountId,r.reference,r.helpType,r.detailsEncrypted,r.status,r.route,r.createdAt]);await this.audit(c,e);});}
  private mapRequest(r:any):RequestRow|undefined{return r?{id:r.id,accountId:r.account_id,reference:r.reference,helpType:r.help_type,detailsEncrypted:r.details_encrypted,status:r.status,route:r.route,createdAt:r.created_at.toISOString()}:undefined;}
  async listRequests(id:string){return(await this.pool.query('SELECT * FROM support_requests WHERE account_id=$1 ORDER BY created_at DESC',[id])).rows.map(r=>this.mapRequest(r)!);}
  async getRequest(id:string){return this.mapRequest((await this.pool.query('SELECT * FROM support_requests WHERE id=$1',[id])).rows[0]);}
  async pauseRequest(id:string,owner:string,e:AuditEvent){let changed=false;await this.transaction(async c=>{changed=(await c.query('UPDATE support_requests SET status=$1 WHERE id=$2 AND account_id=$3',['paused',id,owner])).rowCount===1;if(changed)await this.audit(c,e);});return changed;}
  async saveApplication(r:ApplicationRow,e:AuditEvent){await this.transaction(async c=>{await c.query('INSERT INTO professional_applications (id,account_id,professional_role,status,evidence_encrypted,created_at) VALUES ($1,$2,$3,$4,$5,$6)',[r.id,r.accountId,r.professionalRole,r.status,r.evidenceEncrypted,r.createdAt]);await this.audit(c,e);});}
  async listApplications(id:string){return(await this.pool.query('SELECT * FROM professional_applications WHERE account_id=$1',[id])).rows.map(r=>({id:r.id,accountId:r.account_id,professionalRole:r.professional_role,status:r.status,evidenceEncrypted:r.evidence_encrypted,createdAt:r.created_at.toISOString()}));}
  async close(){await this.pool.end();}
}
