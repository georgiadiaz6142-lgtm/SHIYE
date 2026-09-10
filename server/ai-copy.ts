import { createHash } from 'node:crypto';
import { readFile,writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { copyInput,copyUsage,copySource,type CopyInput } from '../shared/ai-copy.js';
import { Fault } from '../shared/contracts.js';
import { editJson } from './local-json.js';
import { CopyProviderFault,validateCopyThumbnail,type CopyProvider,type CopyResult } from './copy-provider.js';
import type { CopySettings,CopySettingsStore } from './copy-settings.js';
export type CopyIdentity={owner:string;inviteId?:string;registeredAt?:number;member?:boolean};
const operation=z.object({id:z.string().uuid(),owner:z.string(),fingerprint:z.string(),bookId:z.string(),pageId:z.string(),sourceRevision:z.string(),month:z.string(),createdAt:z.number(),status:z.enum(['pending','succeeded','failed']),dispatchedAt:z.number().optional(),finishedAt:z.number().optional(),resultCipher:z.string().optional(),source:copySource.optional(),usage:copyUsage.optional(),requestId:z.string().optional(),estimatedYuan:z.number().nullable().optional(),billing:z.enum(['not-dispatched','unknown','usage-reported']).default('not-dispatched'),error:z.object({errorType:z.string(),message:z.string()}).optional()}).strict();
const schema=z.object({version:z.literal(1),operations:z.array(operation)}).strict();
type State=z.infer<typeof schema>;type Operation=z.infer<typeof operation>;
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
export const copyMonth=(at:number)=>new Date(at+8*3600000).toISOString().slice(0,7);
export class AICopy {
 private active=new Map<string,Promise<void>>();
 constructor(readonly file:string,readonly settings:CopySettingsStore,private seal:(s:string)=>string,private unseal:(s:string)=>string,private injected?:CopyProvider,private now=()=>Date.now(),private timeout=45000){}
 async init(){
  try{await writeFile(this.file,JSON.stringify({version:1,operations:[]}),{flag:'wx',mode:0o600});}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;}
  await this.update(s=>{for(const o of s.operations){if(o.status==='pending'){o.status='failed';o.finishedAt=this.now();o.error={errorType:'COPY_INTERRUPTED',message:'服务重启中断了本次生成，未扣使用次数。不会自动重新调用。'};}if(o.finishedAt&&o.finishedAt<this.now()-86400000)delete o.resultCipher;}});
 }
 private async read(){return schema.parse(JSON.parse(await readFile(this.file,'utf8')));}
 private update<T>(fn:(state:State)=>T|Promise<T>){return editJson(this.file,x=>schema.parse(x),fn);}
 private quota(s:State,identity:CopyIdentity){
  const month=copyMonth(this.now()),guest=identity.owner.startsWith('invite:'),inherited=identity.inviteId&&identity.registeredAt!==undefined&&copyMonth(identity.registeredAt)===month;
  const rows=s.operations.filter(o=>o.owner===identity.owner&&(guest||o.month===month)||!!inherited&&o.owner==='invite:'+identity.inviteId);
  const used=rows.filter(o=>o.status==='succeeded').length,pending=rows.filter(o=>o.status==='pending').length,limit=guest?3:identity.member?100:10;
  return {used,pending,limit,remaining:Math.max(0,limit-used-pending),period:guest?'邀请码累计':'本月',month:guest?null:month};
 }
 async status(identity:CopyIdentity){return {...this.quota(await this.read(),identity),enabled:!!this.injected||await this.settings.available()};}
 async usage(){const s=await this.read();return {attempts:s.operations.filter(o=>o.dispatchedAt!==undefined).length,succeeded:s.operations.filter(o=>o.status==='succeeded').length,failed:s.operations.filter(o=>o.status==='failed').length,pending:s.operations.filter(o=>o.status==='pending').length,knownEstimatedYuan:s.operations.reduce((sum,o)=>sum+(o.estimatedYuan||0),0),unknownBilling:s.operations.filter(o=>o.dispatchedAt!==undefined&&o.estimatedYuan==null).length,items:s.operations.slice(-100).reverse().map(({id,createdAt,status,usage,billing,estimatedYuan,error})=>({id,createdAt,status,usage,billing,estimatedYuan,errorType:error?.errorType}))};}
 async submit(authorize:()=>Promise<CopyIdentity>,value:unknown){
  const input=copyInput.parse(value),identity=await authorize(),fingerprint=sha(JSON.stringify(input));
  // An exact retry can retrieve a finished operation even after configuration is disabled.
  const prior=(await this.read()).operations.find(o=>o.owner===identity.owner&&o.id===input.operationId);
  if(prior){this.same(prior,fingerprint);return this.public(prior);}
  await validateCopyThumbnail(input);
  if(!this.injected)await this.settings.provider();
  const inserted=await this.update(async s=>{
   const fresh=await authorize();if(fresh.owner!==identity.owner)throw new Fault(409,'COPY_IDENTITY_CHANGED','身份已切换，请重新打开文案面板。');
   const old=s.operations.find(o=>o.owner===identity.owner&&o.id===input.operationId);if(old){this.same(old,fingerprint);return false;}
   const quota=this.quota(s,fresh);if(!quota.remaining)throw new Fault(429,'COPY_QUOTA_EXHAUSTED',`${quota.period}文案次数已用完，仍可继续自己写字。`);
   const config=await this.settings.read();if(!this.injected&&s.operations.filter(o=>o.dispatchedAt!==undefined||o.status==='pending').length>=config.maxCalls)throw new Fault(503,'COPY_SERVICE_LIMIT','文案服务请求上限已到，请联系管理员。');
   s.operations.push({id:input.operationId,owner:identity.owner,fingerprint,bookId:input.bookId,pageId:input.pageId,sourceRevision:input.sourceRevision,month:copyMonth(this.now()),createdAt:this.now(),status:'pending',billing:'not-dispatched'});return true;
  });
  const key=identity.owner+':'+input.operationId;
  if(inserted){const task=this.run(identity,input,authorize).catch(()=>{}).finally(()=>this.active.delete(key));this.active.set(key,task);}
  return this.get(identity,input.operationId);
 }
 private same(o:Operation,hash:string){if(o.fingerprint!==hash)throw new Fault(409,'COPY_OPERATION_CONFLICT','同一次文案请求不能更换输入内容，请新建一次生成。');}
 async get(identity:CopyIdentity,id:string){z.string().uuid().parse(id);const o=(await this.read()).operations.find(o=>o.owner===identity.owner&&o.id===id);if(!o)throw new Fault(404,'COPY_NOT_FOUND','没有找到本次文案任务。');return this.public(o);}
 private public(o:Operation){return {operationId:o.id,bookId:o.bookId,pageId:o.pageId,sourceRevision:o.sourceRevision,status:o.status,...(o.status==='succeeded'&&o.resultCipher&&o.finishedAt!>this.now()-86400000?{text:this.unseal(o.resultCipher),source:o.source}:{}),...(o.status==='succeeded'&&(!o.resultCipher||o.finishedAt!<=this.now()-86400000)?{previewExpired:true}:{}),...(o.error?{error:o.error}:{}),charged:o.status==='succeeded'};}
 private async run(identity:CopyIdentity,input:CopyInput,authorize:()=>Promise<CopyIdentity>){
  let config:CopySettings|undefined,result:CopyResult|undefined;const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
  try{
   if((await authorize()).owner!==identity.owner)throw new Fault(409,'COPY_IDENTITY_CHANGED','身份已切换，本次生成已停止。');
   const provider=this.injected||await this.settings.provider();config=await this.settings.read();
   await this.update(s=>{const o=s.operations.find(o=>o.owner===identity.owner&&o.id===input.operationId)!;o.dispatchedAt=this.now();o.billing='unknown';});
   const deadline=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new CopyProviderFault(504,'COPY_TIMEOUT','生成超时，本次不扣使用次数。不会自动重新调用。'));},this.timeout);});
   result=await Promise.race([provider.generate(input,controller.signal),deadline]);
   const text=z.string().trim().min(1).max(800).parse(result.text);if(/<\/?[a-z][^>]*>/i.test(text))throw new Fault(502,'COPY_RESULT_INVALID','文案格式无效，本次不扣使用次数。');
   await this.update(s=>{const o=s.operations.find(o=>o.owner===identity.owner&&o.id===input.operationId)!;o.status='succeeded';o.finishedAt=this.now();o.resultCipher=this.seal(text);o.source={version:1,kind:'copy',operationId:o.id,provider:result!.provider,model:result!.model,generatedAt:this.now()};o.usage=result!.usage;o.requestId=result!.requestId;o.billing=result!.usage?'usage-reported':'unknown';o.estimatedYuan=result!.usage&&config!.inputRate!==null&&config!.outputRate!==null?(result!.usage.inputTokens*config!.inputRate+result!.usage.outputTokens*config!.outputRate)/1e6:null;});
  }catch(error){
   const fault=error instanceof Fault?error:new Fault(502,'COPY_FAILED','文案生成未完成，本次不扣使用次数。');
   await this.update(s=>{const o=s.operations.find(o=>o.owner===identity.owner&&o.id===input.operationId)!;o.status='failed';o.finishedAt=this.now();o.error={errorType:fault.errorType,message:fault.message};const usage=error instanceof CopyProviderFault?error.usage:result?.usage;if(usage){o.usage=usage;o.billing='usage-reported';}if(error instanceof CopyProviderFault)o.requestId=error.requestId;o.estimatedYuan=usage&&config&&config.inputRate!==null&&config.outputRate!==null?(usage.inputTokens*config.inputRate+usage.outputTokens*config.outputRate)/1e6:null;});
  }finally{clearTimeout(timer);}
 }
 async idle(){await Promise.all([...this.active.values()]);}
}
