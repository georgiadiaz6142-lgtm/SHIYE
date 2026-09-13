import type {ObjectDocumentGroup} from './object-documents.js';
import { CopyPromptStore } from './copy-prompt.js';
import { readFile,writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { Fault } from '../shared/contracts.js';
import { editJson } from './local-json.js';
import { ArkCopyProvider,ARK_COPY_ENDPOINT,QwenCopyProvider,QWEN_COPY_ENDPOINT,QWEN_COPY_MODEL } from './copy-provider.js';
const providerId=z.enum(['ark','qwen']);
const input=z.object({revision:z.number().int().nonnegative(),providerId:providerId.optional(),apiKey:z.string().max(512).default(''),model:z.string().trim().max(120).regex(/^[A-Za-z0-9._:-]*$/),enabled:z.boolean(),maxCalls:z.number().int().min(1).max(100000),approvedUntil:z.number().int().positive().nullable(),inputRate:z.number().nonnegative().max(10000).nullable(),outputRate:z.number().nonnegative().max(10000).nullable()}).strict();
// Existing version-1 files without a provider field belong to Ark.
const schema=input.omit({apiKey:true}).extend({providerId:providerId.default('ark'),version:z.literal(1),cipher:z.string(),updatedAt:z.number(),actor:z.string()}).strict();
export type CopySettings=z.infer<typeof schema>;
export class CopySettingsStore {
 constructor(readonly file:string,private seal:(s:string)=>string,private unseal:(s:string)=>string,private now=()=>Date.now(),readonly prompts?:CopyPromptStore,readonly documents?:ObjectDocumentGroup){if(documents&&prompts&&prompts.documents!==documents)throw Error('文案配置和提示词必须共用数据分组。');}
 private get cell(){return this.documents?.cell('copy-config',v=>schema.parse(v));}
 private update<R>(change:(s:z.infer<typeof schema>)=>R|Promise<R>){return this.cell?this.cell.update(change):editJson(this.file,v=>schema.parse(v),change);}
 private blank():CopySettings{return {version:1,revision:0,providerId:'qwen',cipher:'',model:QWEN_COPY_MODEL,enabled:false,maxCalls:10,approvedUntil:null,inputRate:0.2,outputRate:0.8,updatedAt:0,actor:''};}
 async read(){try{return this.cell?await this.cell.read():schema.parse(JSON.parse(await readFile(this.file,'utf8')));}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return this.blank();throw new Fault(503,'COPY_CONFIG_UNAVAILABLE','文案配置暂时无法读取。');}}
 async public(){const s=await this.read();return {kind:'copy',name:'AI 手账文案',providerId:s.providerId,provider:s.providerId==='qwen'?'阿里云百炼 · 千问（北京）':'火山方舟',endpoint:s.providerId==='qwen'?QWEN_COPY_ENDPOINT:ARK_COPY_ENDPOINT,revision:s.revision,model:s.model,enabled:s.enabled,configured:!!s.cipher&&!!s.model,apiKeyMasked:s.cipher?'已配置，内容隐藏':'未配置',maxCalls:s.maxCalls,approvedUntil:s.approvedUntil,inputRate:s.inputRate,outputRate:s.outputRate,updatedAt:s.updatedAt};}
 async save(actor:string,value:unknown){
  const v=input.parse(value);if(v.apiKey&&(!/^[\x21-\x7e]+$/.test(v.apiKey)||v.apiKey.length<8))throw new Fault(422,'COPY_KEY_INVALID','请填写有效的所选供应商 API Key。');
  if(this.cell)await this.cell.initialize(this.blank());else try{await writeFile(this.file,JSON.stringify(this.blank()),{flag:'wx',mode:0o600});}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;}
  await this.update(s=>{if(s.revision!==v.revision)throw new Fault(409,'CONFIG_CHANGED','配置已被更新，请刷新后再保存。');const nextProvider=v.providerId??s.providerId;
   if(nextProvider!==s.providerId&&s.cipher&&!v.apiKey)throw new Fault(422,'COPY_PROVIDER_KEY_REQUIRED','切换供应商时请填写新的 API Key，原供应商密钥不能混用。');
   const cipher=v.apiKey?this.seal(v.apiKey):s.cipher;
   if(v.enabled&&(!cipher||!v.model||!v.approvedUntil||v.approvedUntil<=this.now()))throw new Fault(422,'COPY_APPROVAL_REQUIRED','启用前请填写密钥、模型、累计请求上限和未来的截止时间。');
   const {apiKey:_,...rest}=v;Object.assign(s,rest,{providerId:nextProvider,cipher,version:1,revision:s.revision+1,updatedAt:this.now(),actor});});return this.public();
 }
 async available(){const s=await this.read();return !!s.enabled&&!!s.cipher&&!!s.model&&!!s.approvedUntil&&s.approvedUntil>this.now();}
 async provider(){const s=await this.read();if(!s.enabled||!s.cipher||!s.model)throw new Fault(503,'COPY_DISABLED','AI 文案尚未启用，可以继续自己写字。');if(!s.approvedUntil||s.approvedUntil<=this.now())throw new Fault(503,'COPY_APPROVAL_EXPIRED','文案服务授权期限已到，请联系管理员。');const Provider=s.providerId==='qwen'?QwenCopyProvider:ArkCopyProvider;return new Provider(this.unseal(s.cipher),s.model,undefined,(await this.prompts?.read())?.text);}
}
