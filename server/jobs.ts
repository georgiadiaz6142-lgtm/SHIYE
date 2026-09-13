import {CloudTasks,type TaskGrant} from './cloud-tasks.js';
import { randomUUID, createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { pixelBox, type LiveOptions } from './baidu.js';
import { Store } from './store.js';
import { fixture, mask, compose, fixtureTarget, WIDTH, HEIGHT, normalizeBaidu } from './images.js';
import { Fault, type Session, type StartInput, type RefineInput, type Job, type Candidate, type StoreData } from '../shared/contracts.js';

export class Jobs {
  private tail: Promise<unknown> = Promise.resolve();
  constructor(readonly store: Store, readonly ttl: number, readonly latency = 350, readonly live?: LiveOptions,private executionMs=120000,readonly tasks?:CloudTasks) {if(tasks&&tasks.documents!==store.objects?.documents)throw Error("云任务必须和抠图共用数据分组。");}
  async readSession(owner:string,id:string){return this.session(owner,id,await this.store.read());}
  async readJob(owner:string,id:string){await this.recoverStale();return this.get(owner,id,await this.store.read());}
  private async recoverStale(){
    if(!this.store.objects)return;
    const stale=(j:Job)=>j.status==='running'&&(!j.leaseUntil||j.leaseUntil<=Date.now())||!!this.tasks&&j.status==='queued'&&j.createdAt+CloudTasks.queueMs<=Date.now();
    if(!(await this.store.read()).jobs.some(stale))return;
    await this.store.transaction(d=>{for(const j of d.jobs)if(stale(j)){j.status='failed';j.updatedAt=Date.now();j.error={errorType:'RECOVERY_REQUIRES_REVIEW',message:'任务执行期限已到；供应商处理与计费情况可能未知，不会自动重新调用。',retryable:false};}});
  }
  assertLive() {
    if(!this.live||(this.live.approvedUntil!==null&&this.live.approvedUntil<=Date.now()))throw new Fault(403,'LIVE_NOT_APPROVED','百度测试尚未启用或授权已到期，请先确认额度和测试照片。');
  }
  async uploadPhoto(owner:string, operationId:string, bytes:Buffer) {
    this.assertLive();
    const image=await normalizeBaidu(bytes),sourceHash=createHash('sha256').update(image.png).digest('hex');
    return this.store.transaction(async d=>{
      this.assertLive();
      const old=d.sessions.find(s=>s.owner===owner&&s.operationId===operationId);
      if(old){if(old.sourceHash!==sourceHash)throw new Fault(409,'OPERATION_CONFLICT','同一次上传不能更换图片。');return this.session(owner,old.imageSessionId,d);}
      const objectKey=randomUUID(),imageSessionId=randomUUID(),expiresAt=Math.min(Date.now()+this.ttl,this.live!.approvedUntil??Infinity);
      await this.store.putMedia(objectKey,image.png);
      const session:Session={imageSessionId,owner,operationId,objectKey,sourceHash,sourceRevision:1,width:image.width,height:image.height,expiresAt,candidates:[],promptRevision:0,fixture:false};
      d.sessions.push(session);d.media.push({mediaId:objectKey,owner,imageSessionId,expiresAt});return session;
    });
  }
  session(owner: string, id: string, data = this.store.data) {
    const s = data.sessions.find(s=>s.owner===owner && s.imageSessionId===id);
    if (!s) throw new Fault(404,'NOT_FOUND','找不到这张图片。');
    if (s.expiresAt <= Date.now()) throw new Fault(410,'EXPIRED','临时图片已过期，请重新开始。');
    return s;
  }
  async upload(owner: string, operationId: string) {
    if(this.live)throw new Fault(409,'MODE_MISMATCH','百度模式不使用模拟测试图。');
    return this.store.transaction(async d=>{
      const old=d.sessions.find(s=>s.owner===owner&&s.operationId===operationId);
      if(old) { this.session(owner,old.imageSessionId,d);return old; }
      const objectKey=randomUUID(), imageSessionId=randomUUID(), expiresAt=Date.now()+this.ttl;
      await this.store.putMedia(objectKey,await fixture());
      const s:Session={imageSessionId,owner,operationId,objectKey,sourceRevision:1,width:WIDTH,height:HEIGHT,expiresAt,candidates:[],promptRevision:0,fixture:true};
      d.sessions.push(s);d.media.push({mediaId:objectKey,owner,imageSessionId,expiresAt});return s;
    });
  }
  async submit(owner:string, input:StartInput|RefineInput, kind:'auto'|'refine',grant?:TaskGrant) {
    if(this.tasks&&!grant)throw new Fault(401,'TASK_ACCESS_REQUIRED','请重新登录后操作。');
    await this.recoverStale();
    const fingerprint=createHash('sha256').update(JSON.stringify({kind,input})).digest('hex');
    const reserve=()=>this.store.transaction(async d=>{
      const s=this.session(owner,input.imageSessionId,d);
      const old=d.jobs.find(j=>j.owner===owner&&j.operationId===input.operationId);
      if(old) { if(old.fingerprint!==fingerprint) throw new Fault(409,'OPERATION_CONFLICT','同一次操作不能携带不同内容。');return old; }
      if(s.fixture===!!this.live)throw new Fault(409,'MODE_MISMATCH','这张图片属于另一种处理模式，请重新打开工坊。');
      if(!s.fixture)this.assertLive();
      if (s.objectKey!==input.objectKey||s.sourceRevision!==input.sourceRevision) throw new Fault(409,'SOURCE_MISMATCH','照片已经改变。');
      if(d.jobs.some(j=>j.owner===owner&&['queued','running'].includes(j.status))) throw new Fault(409,'JOB_BUSY','请等待当前任务完成或取消后再试。',true);
      if(kind==='refine') {
        const r=input as RefineInput;
        if(!s.fixture){
          if(!r.box||r.positivePoints?.length||r.negativePoints?.length||r.outlinePoints?.length)throw new Fault(422,'UNSUPPORTED_PROMPT','百度目前仅支持框选提示，不支持保留点、排除点或圈线。');
          pixelBox(r.box,s.width,s.height);
        }else if(r.box)throw new Fault(422,'UNSUPPORTED_PROMPT','模拟流程请使用圈线或保留点。');
        if(r.promptRevision<=s.promptRevision) throw new Fault(409,'STALE_PROMPT','修正已经更新，请使用最新结果。');
        if(r.targetCandidateId&&!s.candidates.some(c=>c.candidateId===r.targetCandidateId&&c.candidateRevision===r.candidateRevision)) throw new Fault(409,'STALE_CANDIDATE','候选已经更新。');
        s.promptRevision=r.promptRevision;
      }
      const job:Job={jobId:randomUUID(),owner,operationId:input.operationId,fingerprint,kind,status:'queued',input,createdAt:Date.now(),updatedAt:Date.now(),expiresAt:s.expiresAt,provider:s.fixture?'mock':'baidu',mock:s.fixture,cost:s.fixture?{currency:'USD',amount:0,simulated:true}:{currency:'CNY',amount:null,simulated:false}};
      s.latestJobId=job.jobId;d.jobs.push(job);
      if(this.tasks)await this.tasks.reserve('segmentation',owner,job.jobId,{jobId:job.jobId},grant!);return job;
    });
    const job=await (this.tasks?this.tasks.documents.transaction(reserve):reserve());
    if(this.tasks)await this.tasks.notifyOperation('segmentation',owner,job.jobId);
    else if(job.status==='queued') this.enqueue(job.jobId);
    return job;
  }
  get(owner:string,id:string,data=this.store.data) {
    const j=data.jobs.find(j=>j.owner===owner&&j.jobId===id);
    if(!j) throw new Fault(404,'NOT_FOUND','任务不存在。');
    return j.expiresAt<=Date.now()?{...j,status:'expired' as const,candidates:undefined}:j;
  }
  async cancel(owner:string,id:string) {
    return this.store.transaction(d=>{
      const j=d.jobs.find(j=>j.owner===owner&&j.jobId===id);
      if(!j)throw new Fault(404,'NOT_FOUND','任务不存在。');
      if(['queued','running'].includes(j.status)) {j.status='cancelled';j.updatedAt=Date.now();}
      return j;
    });
  }
  async expire(limit=100) {
    await this.recoverStale();
    const obsolete = await this.store.transaction(d=>{
      const now=Date.now();
      for(const j of d.jobs)if(j.expiresAt<=now){j.status='expired';delete j.candidates;}
      const ids=d.media.filter(m=>m.expiresAt<=now).map(m=>m.mediaId);

      for(const s of d.sessions)if(s.expiresAt<=now)s.candidates=[];
      for(const n of d.naming||[])if(n.expiresAt<=now)delete n.name;
      return ids.slice(0,limit);
    });
    // Only newly managed media files under the configured local TTL are removed. No user assets or archives.
    for(const id of obsolete){await this.store.removeMedia(id);await this.store.transaction(d=>{d.media=d.media.filter(m=>m.mediaId!==id||m.expiresAt>Date.now());});}
  }
  async recover() {
    await this.expire();
    await this.recoverStale();
    // This provider is deterministic and makes no external request. Never apply this rule to live jobs.
    const ids=await this.store.transaction(d=>{
      const resume:string[]=[];
      for(const j of d.jobs.filter(j=>['queued','running'].includes(j.status))){
        if(this.store.objects){
          if(j.status==='queued'&&j.providerAttemptedAt===undefined)resume.push(j.jobId);
          continue;
        }
        if(j.provider==='baidu'){
          j.status='failed';j.updatedAt=Date.now();j.error={errorType:'RECOVERY_REQUIRES_REVIEW',message:'服务曾中断；不会重新提交百度请求，请核对调用记录后再操作。',retryable:false};
        }else{j.status='queued';resume.push(j.jobId);}
      }
      return resume;
    });
    if(!this.tasks)ids.forEach(id=>this.enqueue(id));
  }
  async execute(owner:string,id:string,authorize:()=>Promise<unknown>){
    await this.recoverStale();const job=this.get(owner,id,await this.store.read());
    if(job.status==='queued')await this.run(id,authorize);
  }
  private enqueue(id:string) { this.tail=this.tail.then(()=>this.run(id)).catch(()=>{}); }
  async idle() { await this.tail; }
  private async runBaidu(job:Job,authorize?:()=>Promise<unknown>) {
    const session=await this.readSession(job.owner,job.input.imageSessionId),input=job.input as RefineInput;
    const source=await this.store.getMedia(session.objectKey);
    const dispatch=await this.store.transaction(async d=>{
      await authorize?.();
      const j=d.jobs.find(j=>j.jobId===job.jobId)!;
      if(j.status!=='running'||j.executionId!==job.executionId||j.providerAttemptedAt!==undefined||j.leaseUntil!==undefined&&j.leaseUntil<=Date.now()||this.session(j.owner,j.input.imageSessionId,d).latestJobId!==j.jobId)return false;
      this.assertLive();
      if(this.live!.maxCalls!==null&&d.jobs.filter(j=>j.provider==='baidu'&&j.providerAttemptedAt!==undefined).length>=this.live!.maxCalls)throw new Fault(429,'TEST_CALL_LIMIT','本轮测试调用上限已到，需核对额度后再继续。');
      j.providerAttemptedAt=Date.now();return true;
    });
    if(!dispatch)return;
    const result=await this.live!.provider.segment(source,job.kind==='refine'?input.box:undefined);
    await this.persist(()=>this.store.transaction(d=>{const j=d.jobs.find(j=>j.jobId===job.jobId)!;if(j.executionId===job.executionId)j.providerRequestId=result.requestId;}));
    const output=await compose(source,result.mask);
    await this.persist(()=>this.store.transaction(async d=>{
      const j=d.jobs.find(j=>j.jobId===job.jobId)!;
      if(j.status!=='running'||j.executionId!==job.executionId||j.expiresAt<=Date.now()||j.leaseUntil!==undefined&&j.leaseUntil<=Date.now())return;
      const s=this.session(job.owner,job.input.imageSessionId,d);
      if(s.latestJobId!==j.jobId)return;
      const old=s.candidates.find(c=>c.candidateId===input.targetCandidateId),maskRef=randomUUID(),transparentRef=randomUUID();
      const candidate:Candidate={candidateId:old?.candidateId||randomUUID(),candidateRevision:(old?.candidateRevision||0)+1,imageSessionId:s.imageSessionId,sourceRevision:s.sourceRevision,maskRef,transparentRef,boundingBox:output.box,expiresAt:s.expiresAt,name:job.kind==='auto'?'自动前景（可能含多个物体）':'框选抠图',mock:false,providerRequestId:result.requestId};
      for(const [mediaId,bytes] of [[maskRef,result.mask],[transparentRef,output.png]] as const){
        await this.store.putMedia(mediaId,bytes);d.media.push({mediaId,owner:s.owner,imageSessionId:s.imageSessionId,expiresAt:s.expiresAt});
      }
      s.candidates=job.kind==='auto'?[candidate]:[...s.candidates.filter(c=>c.candidateId!==input.targetCandidateId),candidate];
      j.candidates=[candidate];j.status='succeeded';j.updatedAt=Date.now();
    }));
  }
  private async persist<T>(save:()=>Promise<T>):Promise<T>{
    for(let i=0;;i++){try{return await save();}catch(e){if(i>=2)throw e;await delay(20*(i+1));}}
  }
  private async run(id:string,authorize?:()=>Promise<unknown>) {
    const executionId=randomUUID();
    try {
      const job=await this.store.transaction(d=>{
        const j=d.jobs.find(j=>j.jobId===id);
        if(!j||j.status!=='queued')return null;
        if(j.expiresAt<=Date.now()){j.status='expired';return null;}
        j.status='running';j.executionId=executionId;if(this.store.objects)j.leaseUntil=Date.now()+this.executionMs;if(j.mock)j.providerRequestId=`mock:${j.jobId}`;j.updatedAt=Date.now();return j;
      });
      if(!job)return;
      await authorize?.();
      if(job.provider==='baidu'){await this.runBaidu(job,authorize);return;}
      await delay(this.latency);
      const session=await this.readSession(job.owner,job.input.imageSessionId);
      const input=job.input as RefineInput;
      const targets=job.kind==='auto'?[0,1]:[fixtureTarget(input.positivePoints||input.outlinePoints||[])];
      const source=await this.store.getMedia(session.objectKey);
      // Output files are written only while the current task remains eligible to commit.
      await this.persist(()=>this.store.transaction(async d=>{
        const results:Candidate[]=[];
        const j=d.jobs.find(j=>j.jobId===id)!;
        const s=this.session(job.owner,job.input.imageSessionId,d);
        if(j.status!=='running'||j.executionId!==executionId||j.leaseUntil!==undefined&&j.leaseUntil<=Date.now()||s.latestJobId!==id)return;
        for(const index of targets){
          const bytes=await mask(index), output=await compose(source,bytes), maskRef=randomUUID(), transparentRef=randomUUID();
          const old=s.candidates.find(c=>c.candidateId===input.targetCandidateId);
          const candidate:Candidate={candidateId:old?.candidateId||randomUUID(),candidateRevision:(old?.candidateRevision||0)+1,imageSessionId:s.imageSessionId,sourceRevision:s.sourceRevision,maskRef,transparentRef,boundingBox:output.box,expiresAt:s.expiresAt,name:`模拟形状 ${index+1}`,mock:true};
          for(const [mediaId,buffer] of [[maskRef,bytes],[transparentRef,output.png]] as const){
            await this.store.putMedia(mediaId,buffer);d.media.push({mediaId,owner:s.owner,imageSessionId:s.imageSessionId,expiresAt:s.expiresAt});
          }
          results.push(candidate);
        }
        s.candidates=job.kind==='auto'?results:[...s.candidates.filter(c=>c.candidateId!==input.targetCandidateId),...results];
        j.candidates=results;j.status='succeeded';j.updatedAt=Date.now();
      }));
    }catch(e){
      await this.store.transaction(d=>{
        const j=d.jobs.find(j=>j.jobId===id);if(!j||j.executionId!==executionId||!['queued','running'].includes(j.status))return;
        j.status=e instanceof Fault&&e.errorType==='EXPIRED'?'expired':'failed';j.updatedAt=Date.now();j.error={errorType:e instanceof Fault?e.errorType:'PROCESSING_FAILED',message:e instanceof Fault?e.message:'处理失败，已有结果仍保留。',retryable:false};
      });
    }
  }
}
