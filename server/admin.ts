import { createHash,randomBytes,randomUUID,scrypt,timingSafeEqual,createCipheriv,createDecipheriv } from 'node:crypto';
import { readFile,writeFile,access as fileExists } from 'node:fs/promises';
import { z } from 'zod';
import { Fault,type Box } from '../shared/contracts.js';
import { InviteAccess,generateInvites,inviteHash } from './access.js';
import { editJson } from './local-json.js';
import { BaiduProvider } from './baidu.js';
const feature=z.enum(['cutout','naming']);export type Feature=z.infer<typeof feature>;
const event=z.object({id:z.string(),at:z.number(),actor:z.string(),action:z.string(),target:z.string()});
const apiSchema=z.object({enabled:z.boolean(),cipher:z.string(),revision:z.number(),testedAt:z.number().optional(),lastCall:z.object({at:z.number(),status:z.string(),error:z.string().optional()}).optional()});
const schema=z.object({version:z.literal(1),accountId:z.string().uuid().optional(),role:z.literal('admin').optional(),username:z.string(),salt:z.string(),passwordHash:z.string(),apis:z.object({cutout:apiSchema,naming:apiSchema}),audit:z.array(event)});
type Document=z.infer<typeof schema>;
const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
const passwordHash=(password:string,salt:string)=>new Promise<Buffer>((resolve,reject)=>scrypt(password,salt,64,(e,key)=>e?reject(e):resolve(key)));
const audit=(actor:string,action:string,target='')=>({id:randomUUID(),at:Date.now(),actor,action,target});
export class Admin {
 private key!:Buffer;private accountId='';private sessions=new Map<string,{accountId:string;role:'admin';username:string;expiresAt:number}>();private limits=new Map<string,{count:number;until:number}>();
 private proofs=new Map<string,{fingerprint:string;expiresAt:number;revision:number}>();private providers=new Map<string,BaiduProvider>();
 constructor(readonly file:string,readonly access:InviteAccess,private factory=(key:string,secret:string)=>new BaiduProvider(key,secret)){}
 async init(initial:{apiKey:string;secretKey:string;cutout:boolean;naming:boolean},receipt:string){
  try{this.key=await readFile(this.file+'.key');if(this.key.length!==32)throw Error('key');}
  catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw Error('管理员加密文件无效，已保留原文件。');try{await fileExists(this.file);throw Error('管理员加密密钥缺失，不能重新生成。');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}this.key=randomBytes(32);await writeFile(this.file+'.key',this.key,{flag:'wx',mode:0o600});}
  try{const d=await this.read();this.decrypt(d.apis.cutout.cipher);this.decrypt(d.apis.naming.cipher);this.accountId=d.accountId&&d.role?d.accountId:await this.update(current=>{current.accountId??=randomUUID();current.role='admin';current.audit.push(audit('本机初始化','绑定管理员账号身份',current.accountId));return current.accountId;});return;}
  catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw Error('管理员数据无法读取，已保留原文件。');}
  const username='admin',password=randomBytes(18).toString('base64url'),salt=randomBytes(16).toString('hex'),cipher=this.encrypt(JSON.stringify({apiKey:initial.apiKey,secretKey:initial.secretKey}));
  const data:Document={version:1,accountId:randomUUID(),role:'admin',username,salt,passwordHash:(await passwordHash(password,salt)).toString('hex'),apis:{cutout:{enabled:initial.cutout,cipher,revision:0},naming:{enabled:initial.naming,cipher,revision:0}},audit:[audit('本机初始化','创建管理员')]};
  await writeFile(receipt,`拾页本机管理员\n地址：http://127.0.0.1:4176/admin\n用户名：${username}\n密码：${password}\n首次登录后可在后台修改密码。请妥善保存本文件。\n`,{flag:'wx',mode:0o600});
  await writeFile(this.file,JSON.stringify(data),{flag:'wx',mode:0o600});this.accountId=data.accountId!;
 }
 private async read(){return schema.parse(JSON.parse(await readFile(this.file,'utf8')));}
 private update<T>(fn:(data:Document)=>T|Promise<T>){return editJson(this.file,v=>schema.parse(v),fn);}
 private encrypt(text:string){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',this.key,iv),body=Buffer.concat([c.update(text,'utf8'),c.final()]);return Buffer.concat([iv,c.getAuthTag(),body]).toString('base64');}
 private decrypt(text:string){const b=Buffer.from(text,'base64'),c=createDecipheriv('aes-256-gcm',this.key,b.subarray(0,12));c.setAuthTag(b.subarray(12,28));return Buffer.concat([c.update(b.subarray(28)),c.final()]).toString('utf8');}
 session(token?:string){if(!token||token.length>128)return null;const entry=this.sessions.get(hash(token));if(!entry||entry.expiresAt<=Date.now()||entry.accountId!==this.accountId||entry.role!=='admin'){this.sessions.delete(hash(token));return null;}return entry;}
 async login(username:unknown,password:unknown,ip:string){
  const b=this.limits.get(ip)||{count:0,until:Date.now()+900000};if(b.until<=Date.now()){b.count=0;b.until=Date.now()+900000;}if(b.count>=8)throw new Fault(429,'ADMIN_RATE_LIMIT','尝试次数较多，请 15 分钟后重试。');b.count++;this.limits.set(ip,b);
  const d=await this.read(),candidate=typeof password==='string'&&password.length<=128?password:'';
  const valid=timingSafeEqual(await passwordHash(candidate,d.salt),Buffer.from(d.passwordHash,'hex'))&&username===d.username&&d.accountId===this.accountId&&d.role==='admin';
  if(!valid){await this.update(s=>{s.audit.push(audit('未登录','管理员登录失败'));});throw new Fault(401,'ADMIN_LOGIN_FAILED','用户名或密码不正确。');}
  this.limits.delete(ip);for(const [key,value] of this.sessions)if(value.expiresAt<=Date.now())this.sessions.delete(key);
  const token=randomBytes(32).toString('hex');this.sessions.set(hash(token),{accountId:d.accountId!,role:d.role!,username:d.username,expiresAt:Date.now()+8*3600000});await this.update(s=>{s.audit.push(audit(d.username,'管理员登录'));});return token;
 }
 async logout(token:string){const s=this.session(token);this.sessions.delete(hash(token));if(s)await this.update(d=>{d.audit.push(audit(s.username,'退出后台'));});}
 async changePassword(actor:string,old:unknown,next:unknown){
  if(typeof old!=='string'||typeof next!=='string'||next.length<12||next.length>128)throw new Fault(422,'INVALID_PASSWORD','新密码需为 12～128 个字符。');
  await this.update(async d=>{if(!timingSafeEqual(await passwordHash(old,d.salt),Buffer.from(d.passwordHash,'hex')))throw new Fault(403,'INVALID_PASSWORD','原密码不正确。');d.salt=randomBytes(16).toString('hex');d.passwordHash=(await passwordHash(next,d.salt)).toString('hex');d.audit.push(audit(actor,'修改管理员密码'));});this.sessions.clear();this.proofs.clear();
 }
 async migrateInvites(codes:string[]){
  await this.access.update(d=>{let count=0;for(const row of d.invites){if(row.cipher)continue;const code=codes.find(c=>inviteHash(c)===row.hash);if(code){row.cipher=this.encrypt(code);count++;}row.createdAt??=null;row.batch??='历史邀请码';row.trackingSince??=Date.now();}if(count)(d.audit??=[]).push(audit('本机初始化','导入历史邀请码',`${count} 个`));});
 }
 async invites(){const d=await this.access.snapshot();return (d?.invites||[]).map(({hash:_,cipher,...row})=>({...row,canReveal:!!cipher,codeMasked:cipher?'SY-••••••-'+this.decrypt(cipher).slice(-4):'未保存完整码',useCount:row.useCount||0,state:row.status==='disabled'?'disabled':row.status==='bound'?'bound':row.expiresAt&&row.expiresAt<=Date.now()?'expired':row.useCount?'used':row.createdAt?'unused':'unknown'}));}
 async createInvites(actor:string,input:unknown){
  const value=z.object({count:z.number().int().min(1).max(100),batch:z.string().trim().min(1).max(50),note:z.string().max(200).default(''),expiresAt:z.number().int().nullable()}).parse(input);
  if(value.expiresAt!==null&&value.expiresAt<=Date.now())throw new Fault(422,'INVALID_EXPIRY','有效期必须晚于当前时间。');
  const generated=generateInvites(value.count),ids=generated.config.invites.map(i=>i.id);
  await this.access.update(d=>{d.invites.push(...generated.config.invites.map((row,i)=>({...row,expiresAt:value.expiresAt,createdAt:Date.now(),trackingSince:Date.now(),batch:value.batch,note:value.note,cipher:this.encrypt(generated.codes[i]),useCount:0})));(d.audit??=[]).push(audit(actor,'创建邀请码',`${value.batch} · ${value.count} 个`));});return {ids};
 }
 async setInvite(actor:string,id:string,disabled:boolean){await this.access.update(d=>{const row=d.invites.find(i=>i.id===id);if(!row)throw new Fault(404,'NOT_FOUND','邀请码不存在。');if(row.status==='bound')throw new Fault(409,'INVITE_BOUND','已绑定邀请码不能恢复使用。');if(disabled)row.grantVersion=(row.grantVersion||0)+1;row.status=disabled?'disabled':'unbound';(d.audit??=[]).push(audit(actor,disabled?'停用邀请码':'恢复邀请码',id));});}
 async reveal(actor:string,ids:string[]){return this.access.update(d=>{const rows=ids.map(id=>d.invites.find(i=>i.id===id));if(rows.some(i=>!i?.cipher))throw new Fault(404,'CODE_UNAVAILABLE','部分历史码未保存完整内容。');(d.audit??=[]).push(audit(actor,ids.length>1?'导出邀请码':'查看邀请码',ids.length>1?`${ids.length} 个`:ids[0]));return rows.map(i=>({id:i!.id,code:this.decrypt(i!.cipher!)}));});}
 async logs(){const [a,b]=await Promise.all([this.read(),this.access.snapshot()]);return [...a.audit,...(b?.audit||[])].sort((x,y)=>y.at-x.at);}
 async apiEnabled(kind:Feature){return (await this.read()).apis[kind].enabled;}
 async apiList(){const d=await this.read();return (['cutout','naming'] as Feature[]).map(kind=>{const a=d.apis[kind],keys=JSON.parse(this.decrypt(a.cipher));return {kind,provider:'百度智能云',name:kind==='cutout'?'自动抠图':'贴纸自动命名',endpoint:kind==='cutout'?'https://aip.baidubce.com/rest/2.0/image-process/v1/segment':'https://aip.baidubce.com/rest/2.0/image-classify/v2/advanced_general',enabled:a.enabled,configured:!!keys.apiKey&&!!keys.secretKey,apiKeyMasked:keys.apiKey?'••••••'+keys.apiKey.slice(-4):'未配置',secretConfigured:!!keys.secretKey,revision:a.revision,testedAt:a.testedAt,lastCall:a.lastCall};});}
 private async candidate(kind:Feature,input:unknown){const value=z.object({apiKey:z.string().max(512).default(''),secretKey:z.string().max(512).default(''),enabled:z.boolean(),revision:z.number().int()}).strict().parse(input),d=await this.read(),current=d.apis[kind];if(current.revision!==value.revision)throw new Fault(409,'CONFIG_CHANGED','配置已被更新，请刷新后再修改。');const existing=JSON.parse(this.decrypt(current.cipher));return {...value,apiKey:value.apiKey.trim()||existing.apiKey,secretKey:value.secretKey.trim()||existing.secretKey};}
 private fingerprint(kind:Feature,candidate:unknown){return hash(JSON.stringify({kind,candidate}));}
 async testApi(actor:string,session:string,kind:Feature,input:unknown){
  const candidate=await this.candidate(kind,input);if(!candidate.apiKey||!candidate.secretKey)throw new Fault(422,'KEYS_REQUIRED','请填写 API Key 和 Secret Key。');
  try{const result=await this.factory(candidate.apiKey,candidate.secretKey).checkConnection();this.proofs.set(hash(session)+kind,{fingerprint:this.fingerprint(kind,candidate),expiresAt:Date.now()+600000,revision:candidate.revision});await this.update(d=>{d.audit.push(audit(actor,'API 鉴权测试通过',kind));});return result;}
  catch(e){await this.update(d=>{d.audit.push(audit(actor,'API 鉴权测试失败',kind));});throw e;}
 }
 async saveApi(actor:string,session:string,kind:Feature,input:unknown){
  const candidate=await this.candidate(kind,input),proof=this.proofs.get(hash(session)+kind);
  const current=(await this.read()).apis[kind],existing=JSON.parse(this.decrypt(current.cipher));
  const changed=existing.apiKey!==candidate.apiKey||existing.secretKey!==candidate.secretKey;
  if((candidate.enabled||changed)&&(!proof||proof.expiresAt<Date.now()||proof.fingerprint!==this.fingerprint(kind,candidate)))throw new Fault(409,'TEST_REQUIRED','请先测试当前配置，再保存启用。');
  await this.update(d=>{if(d.apis[kind].revision!==candidate.revision)throw new Fault(409,'CONFIG_CHANGED','配置已被更新，请刷新。');d.apis[kind]={...d.apis[kind],enabled:candidate.enabled,cipher:this.encrypt(JSON.stringify({apiKey:candidate.apiKey,secretKey:candidate.secretKey})),revision:candidate.revision+1,...(proof?{testedAt:Date.now()}:{})};d.audit.push(audit(actor,candidate.enabled?'保存并启用 API':'停用 API',kind));});this.proofs.delete(hash(session)+kind);this.providers.clear();
 }
 private async provider(kind:Feature){const d=await this.read(),a=d.apis[kind];if(!a.enabled)throw new Fault(503,'API_DISABLED','该功能暂未启用。');let provider=this.providers.get(kind+a.cipher);if(!provider){const keys=JSON.parse(this.decrypt(a.cipher));provider=this.factory(keys.apiKey,keys.secretKey);this.providers.set(kind+a.cipher,provider);}return provider;}
 private async record(kind:Feature,status:string,error?:string){await this.update(d=>{d.apis[kind].lastCall={at:Date.now(),status,...(error?{error}:{})};});}
 async segment(source:Buffer,box?:Box){try{const result=await(await this.provider('cutout')).segment(source,box);await this.record('cutout','成功');return result;}catch(e){await this.record('cutout','失败',e instanceof Fault?e.errorType:'REQUEST_FAILED');throw e;}}
 async name(source:Buffer){try{const result=await(await this.provider('naming')).name(source);await this.record('naming','成功');return result;}catch(e){await this.record('naming','失败',e instanceof Fault?e.errorType:'REQUEST_FAILED');throw e;}}
}
export { feature };
