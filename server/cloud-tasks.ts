import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Fault } from '../shared/contracts.js';
import type { ObjectDocumentGroup } from './object-documents.js';

export const taskGrant=z.discriminatedUnion('type',[
  z.object({type:z.literal('account'),digest:z.string().regex(/^[a-f0-9]{64}$/)}).strict(),
  z.object({type:z.literal('invite'),inviteId:z.string().uuid(),version:z.number().int().nonnegative(),expiresAt:z.number().int().positive()}).strict(),
]);
export type TaskGrant=z.infer<typeof taskGrant>;
export type TaskKind='copy'|'segmentation';
const row=z.object({id:z.string().uuid(),kind:z.enum(['copy','segmentation']),owner:z.string(),operationId:z.string().uuid(),createdAt:z.number(),expiresAt:z.number(),cipher:z.string().optional(),status:z.enum(['queued','running','done','expired']),scheduledAt:z.number().optional(),executionId:z.string().uuid().optional(),leaseUntil:z.number().optional(),attempts:z.number().int().nonnegative()}).strict();
const state=z.object({version:z.literal(1),tasks:z.array(row)}).strict();
const payload=z.object({grant:taskGrant,input:z.unknown()}).strict();
export type CloudTask={kind:TaskKind;owner:string;operationId:string;grant:TaskGrant;input:unknown};
export interface TaskTransport { notify(taskId:string):Promise<void> }

/** Durable outbox in the SAME atomic document as the business reservation.
 * Transport retries only wake a worker; domain dispatch markers guard AI calls.
 * Encrypted inputs never appear in gateway payloads or error responses.
 */
export class CloudTasks {
  static readonly queueMs=15*60_000;
  constructor(readonly documents:ObjectDocumentGroup,private seal:(v:string)=>string,private unseal:(v:string)=>string,private transport:TaskTransport,private now=()=>Date.now(),private executionMs=180_000){}
  private get cell(){return this.documents.cell('cloud-tasks',v=>state.parse(v));}
  async init(){await this.cell.initialize({version:1,tasks:[]});}
  async reserve(kind:TaskKind,owner:string,operationId:string,input:unknown,grant:TaskGrant){
    const cipher=this.seal(JSON.stringify(payload.parse({grant,input})));
    return this.cell.update(s=>{
      const prior=s.tasks.find(t=>t.kind===kind&&t.owner===owner&&t.operationId===operationId);
      if(prior)return prior.id;
      if(s.tasks.filter(t=>t.cipher).length>=32)throw new Fault(429,'TASK_QUEUE_BUSY','当前处理任务较多，请稍后再试。');
      const id=randomUUID();s.tasks.push({id,kind,owner,operationId,cipher,createdAt:this.now(),expiresAt:this.now()+CloudTasks.queueMs,status:'queued',attempts:0});return id;
    });
  }
  async notifyOperation(kind:TaskKind,owner:string,operationId:string){
    const task=(await this.cell.read()).tasks.find(t=>t.kind===kind&&t.owner===owner&&t.operationId===operationId);
    if(task)await this.notify(task.id);
  }
  private async notify(id:string){
    // Store-before-send: a crash or an uncertain 202 is recovered by maintenance.
    const send=await this.cell.update(s=>{const t=s.tasks.find(t=>t.id===id);if(!t||t.status!=='queued'||t.expiresAt<=this.now()||t.scheduledAt!==undefined&&t.scheduledAt>this.now()-60_000)return false;t.scheduledAt=this.now();return true;});
    if(send)try{await this.transport.notify(id);}catch{/* Remains queued; never resubmit AI directly. */}
  }
  async execute(id:string,run:(task:CloudTask)=>Promise<void>){
    z.string().uuid().parse(id);const executionId=randomUUID();
    const task=await this.cell.update(s=>{
      const t=s.tasks.find(t=>t.id===id);
      if(!t||t.status!=='queued'||t.expiresAt<=this.now()||!t.cipher)return null;
      t.status='running';t.executionId=executionId;t.leaseUntil=this.now()+this.executionMs;t.attempts++;return structuredClone(t);
    });
    if(!task)return;
    // Do not swallow handler/storage failures: leave the lease for recovery.
    const data=payload.parse(JSON.parse(this.unseal(task.cipher!)));
    await run({kind:task.kind,owner:task.owner,operationId:task.operationId,...data});
    await this.cell.update(s=>{const t=s.tasks.find(t=>t.id===id);if(t?.status==='running'&&t.executionId===executionId){t.status='done';delete t.cipher;}});
  }
  async maintain(){
    await this.cell.update(s=>{
      for(const t of s.tasks){
        if(t.expiresAt<=this.now()){t.status='expired';delete t.cipher;}
        else if(t.status==='running'&&t.leaseUntil!==undefined&&t.leaseUntil<=this.now()){
          if(t.attempts>=3){t.status='expired';delete t.cipher;}
          else{t.status='queued';delete t.scheduledAt;}
        }
      }
      s.tasks=s.tasks.filter(t=>t.expiresAt>this.now()-86400_000);
    });
    const pending=(await this.cell.read()).tasks.filter(t=>t.status==='queued'&&(t.scheduledAt===undefined||t.scheduledAt<=this.now()-60_000)).slice(0,10);
    for(const t of pending)await this.notify(t.id);
    return {scheduled:pending.length};
  }
}
