import { readFile,writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { Fault } from '../shared/contracts.js';
import { editJson } from './local-json.js';
import { ArkCopyProvider,ARK_COPY_ENDPOINT } from './copy-provider.js';
const input=z.object({revision:z.number().int().nonnegative(),apiKey:z.string().max(512).default(''),model:z.string().trim().max(120).regex(/^[A-Za-z0-9._:-]*$/),enabled:z.boolean(),maxCalls:z.number().int().min(1).max(100000),approvedUntil:z.number().int().positive().nullable(),inputRate:z.number().nonnegative().max(10000).nullable(),outputRate:z.number().nonnegative().max(10000).nullable()}).strict();
const schema=input.omit({apiKey:true}).extend({version:z.literal(1),cipher:z.string(),updatedAt:z.number(),actor:z.string()}).strict();
export type CopySettings=z.infer<typeof schema>;
export class CopySettingsStore {
 constructor(readonly file:string,private seal:(s:string)=>string,private unseal:(s:string)=>string,private now=()=>Date.now()){}
 private blank():CopySettings{return {version:1,revision:0,cipher:'',model:'',enabled:false,maxCalls:10,approvedUntil:null,inputRate:null,outputRate:null,updatedAt:0,actor:''};}
 async read(){try{return schema.parse(JSON.parse(await readFile(this.file,'utf8')));}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return this.blank();throw new Fault(503,'COPY_CONFIG_UNAVAILABLE','文案配置暂时无法读取。');}}
 async public(){const s=await this.read();return {kind:'copy',name:'AI 手账文案',provider:'火山方舟',endpoint:ARK_COPY_ENDPOINT,revision:s.revision,model:s.model,enabled:s.enabled,configured:!!s.cipher&&!!s.model,apiKeyMasked:s.cipher?'已配置，内容隐藏':'未配置',maxCalls:s.maxCalls,approvedUntil:s.approvedUntil,inputRate:s.inputRate,outputRate:s.outputRate,updatedAt:s.updatedAt};}
 async save(actor:string,value:unknown){
  const v=input.parse(value);if(v.apiKey&&(!/^[\x21-\x7e]+$/.test(v.apiKey)||v.apiKey.length<8))throw new Fault(422,'COPY_KEY_INVALID','请填写有效的方舟 API Key。');
  try{await writeFile(this.file,JSON.stringify(this.blank()),{flag:'wx',mode:0o600});}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;}
  await editJson(this.file,x=>schema.parse(x),s=>{if(s.revision!==v.revision)throw new Fault(409,'CONFIG_CHANGED','配置已被更新，请刷新后再保存。');const cipher=v.apiKey?this.seal(v.apiKey):s.cipher;
   if(v.enabled&&(!cipher||!v.model||!v.approvedUntil||v.approvedUntil<=this.now()))throw new Fault(422,'COPY_APPROVAL_REQUIRED','启用前请填写密钥、模型、累计请求上限和未来的截止时间。');
   const {apiKey:_,...rest}=v;Object.assign(s,rest,{cipher,version:1,revision:s.revision+1,updatedAt:this.now(),actor});});return this.public();
 }
 async available(){const s=await this.read();return !!s.enabled&&!!s.cipher&&!!s.model&&!!s.approvedUntil&&s.approvedUntil>this.now();}
 async provider(){const s=await this.read();if(!s.enabled||!s.cipher||!s.model)throw new Fault(503,'COPY_DISABLED','AI 文案尚未启用，可以继续自己写字。');if(!s.approvedUntil||s.approvedUntil<=this.now())throw new Fault(503,'COPY_APPROVAL_EXPIRED','文案服务授权期限已到，请联系管理员。');return new ArkCopyProvider(this.unseal(s.cipher),s.model);}
}
