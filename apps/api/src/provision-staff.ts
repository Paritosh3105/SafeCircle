import { randomUUID } from 'node:crypto';
import { PostgresStore } from './postgres-store.js';
import { hashPassword, staffRoleSchema, staffLoginSchema } from './staff-password.js';
// Operator-only CLI. Never exposed as an HTTP registration endpoint.
const username=process.argv[2],role=staffRoleSchema.parse(process.argv[3]);
const password=process.env.STAFF_PROVISION_PASSWORD;
const input=staffLoginSchema.parse({username,password});
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL required');
const store=new PostgresStore(process.env.DATABASE_URL);
try{await store.createStaff({id:randomUUID(),username:input.username,role,passwordHash:await hashPassword(input.password),active:true});console.log('Staff identity provisioned.');}finally{await store.close();}
