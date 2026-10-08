import { z } from 'zod';
export const ageBands = ['adult','under18','undisclosed'] as const;
export const helpTypes = ['talk','emotional','legal','safety','practical'] as const;
export const professionalRoles = ['lawyer','psychiatrist','clinical_psychologist','counsellor','ngo_representative','support_worker'] as const;
export const accessSchema = z.object({ ageBand:z.enum(ageBands), jurisdiction:z.string().trim().max(80).default('undisclosed'), confidentialityAcknowledged:z.literal(true) }).strict();
export const recoverySchema = z.object({ recoveryCode:z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export const requestSchema = z.object({ helpType:z.enum(helpTypes), details:z.string().trim().max(2000).default(''), confidentialityAcknowledged:z.literal(true) }).strict();
export const applicationSchema = z.object({ professionalRole:z.enum(professionalRoles), jurisdiction:z.string().trim().min(2).max(80), qualifications:z.string().trim().min(10).max(2000), claimedExperience:z.string().trim().max(1000).default(''), conductAccepted:z.literal(true) }).strict();
export type AgeBand = typeof ageBands[number];
export type HelpType = typeof helpTypes[number];
export type AccessInput = z.infer<typeof accessSchema>;
export type RequestInput = z.infer<typeof requestSchema>;
export type ApplicationInput = z.infer<typeof applicationSchema>;
export interface AccountView { id:string; pseudonym:string; ageBand:AgeBand; jurisdiction:string; notificationsEnabled:false; outsideContactAllowed:false; }
export interface RequestView { id:string; reference:string; helpType:HelpType; details:string; status:'received'|'paused'; route:'adult'|'safeguarding'|'eligibility_review'; createdAt:string; }
export interface SessionView { account:AccountView; csrfToken:string; expiresAt:string; }
export interface ApplicationView { id:string; professionalRole:ApplicationInput['professionalRole']; status:'pending_verification'; createdAt:string; }
export interface Availability { mode:'development'; staffed:false; professionalGuidanceAvailable:false; acceptsRealCases:false; initialSupportFree:true; message:string; }
