import { z } from 'zod';

export const id = z.string().uuid();
export const revision = z.number().int().nonnegative();
export const point = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).strict();
export const box = z.object({x:z.number().min(0).max(1),y:z.number().min(0).max(1),width:z.number().positive().max(1),height:z.number().positive().max(1)}).strict().refine(b=>b.x+b.width<=1&&b.y+b.height<=1);
export type Box = z.infer<typeof box>;
export const initUpload = z.object({ operationId: id, fixture: z.literal(true) }).strict();
export const startJob = z.object({
  operationId: id, imageSessionId: id, objectKey: id, sourceRevision: revision,
}).strict();
export const refineJob = startJob.extend({
  promptRevision: revision,
  targetCandidateId: id.optional(),
  candidateRevision: revision.optional(),
  box: box.optional(),
  outlinePoints: z.array(point).min(3).max(2048).optional(),
  positivePoints: z.array(point).min(1).max(64).optional(),
  negativePoints: z.array(point).max(64).optional(),
}).superRefine((v, ctx) => {
  if (!v.box && !v.outlinePoints?.length && !v.positivePoints?.length)
    ctx.addIssue({ code: 'custom', message: '需要圈选或保留点提示' });
  if (v.targetCandidateId && v.candidateRevision === undefined)
    ctx.addIssue({ code: 'custom', message: '需要候选版本' });
});
export type StartInput = z.infer<typeof startJob>;
export type RefineInput = z.infer<typeof refineJob>;
export type Status = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'expired';
export type ApiError = { errorType: string; message: string; retryable: boolean };
export class Fault extends Error {
  constructor(public status: number, public errorType: string, message: string, public retryable = false) {
    super(message);
  }
}
export type Candidate = {
  candidateId: string; candidateRevision: number; imageSessionId: string; sourceRevision: number;
  maskRef: string; transparentRef: string; boundingBox: { x: number; y: number; width: number; height: number };
  expiresAt: number; name: string; mock: boolean; providerRequestId?: string;
};
export type Session = {
  imageSessionId: string; owner: string; operationId: string; objectKey: string;
  sourceRevision: number; width: number; height: number; expiresAt: number; candidates: Candidate[];
  promptRevision: number; latestJobId?: string; fixture: boolean; sourceHash?: string;
};
export type Job = {
  jobId: string; owner: string; operationId: string; fingerprint: string; kind: 'auto' | 'refine';
  status: Status; input: StartInput | RefineInput; createdAt: number; updatedAt: number;
  expiresAt: number; provider: 'mock' | 'baidu'; providerAttemptedAt?: number; providerRequestId?: string; candidates?: Candidate[];
  error?: ApiError; mock: boolean; cost: { currency: 'USD'; amount: 0; simulated: true } | { currency: 'CNY'; amount: null; simulated: false };
};
export type Media = { mediaId: string; owner: string; imageSessionId: string; expiresAt: number };
export type NamingRecord = { key:string; owner:string; imageSessionId:string; expiresAt:number; attemptedAt:number; status:'attempted'|'succeeded'|'failed'; name?:string; providerRequestId?:string };
export type StoreData = { schemaVersion: 1; sessions: Session[]; jobs: Job[]; media: Media[]; naming?:NamingRecord[] };

const timestamp = z.number().int().nonnegative();
const candidateSchema = z.object({
  candidateId:id,candidateRevision:revision,imageSessionId:id,sourceRevision:revision,
  maskRef:id,transparentRef:id,boundingBox:z.object({x:revision,y:revision,width:z.number().int().positive(),height:z.number().int().positive()}).strict(),
  expiresAt:timestamp,name:z.string().max(100),mock:z.boolean(),providerRequestId:z.string().regex(/^\d{1,20}$/).optional(),
}).strict();
const sessionSchema = z.object({
  imageSessionId:id,owner:z.string().min(1),operationId:id,objectKey:id,sourceRevision:revision,
  width:z.number().int().positive(),height:z.number().int().positive(),expiresAt:timestamp,
  candidates:z.array(candidateSchema),promptRevision:revision,latestJobId:id.optional(),fixture:z.boolean(),sourceHash:z.string().regex(/^[a-f0-9]{64}$/).optional(),
}).strict();
const jobSchema = z.object({
  jobId:id,owner:z.string().min(1),operationId:id,fingerprint:z.string().regex(/^[a-f0-9]{64}$/),kind:z.enum(['auto','refine']),
  status:z.enum(['queued','running','succeeded','failed','cancelled','expired']),input:z.union([startJob,refineJob]),
  createdAt:timestamp,updatedAt:timestamp,expiresAt:timestamp,provider:z.enum(['mock','baidu']),providerAttemptedAt:timestamp.optional(),providerRequestId:z.string().optional(),
  candidates:z.array(candidateSchema).optional(),error:z.object({errorType:z.string(),message:z.string(),retryable:z.boolean()}).strict().optional(),
  mock:z.boolean(),cost:z.union([z.object({currency:z.literal('USD'),amount:z.literal(0),simulated:z.literal(true)}).strict(),z.object({currency:z.literal('CNY'),amount:z.null(),simulated:z.literal(false)}).strict()]),
}).strict();
export const storeSchema = z.object({
  schemaVersion:z.literal(1),sessions:z.array(sessionSchema),jobs:z.array(jobSchema),
  media:z.array(z.object({mediaId:id,owner:z.string().min(1),imageSessionId:id,expiresAt:timestamp}).strict()),
  naming:z.array(z.object({key:z.string().regex(/^[a-f0-9]{64}$/),owner:z.string().min(1),imageSessionId:id,expiresAt:timestamp,attemptedAt:timestamp,status:z.enum(['attempted','succeeded','failed']),name:z.string().max(30).optional(),providerRequestId:z.string().optional()}).strict()).optional(),
}).strict();
