import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { editJson } from './local-json.js';
import { Fault } from '../shared/contracts.js';

export const userSchema=z.object({id:z.string().uuid(),role:z.literal('user'),username:z.string(),salt:z.string(),passwordHash:z.string(),avatar:z.string().nullable().default(null),createdAt:z.number(),inviteId:z.string().uuid()});
export type UserAccount=z.infer<typeof userSchema>;
export const configSchema=z.object({version:z.literal(1),users:z.array(userSchema).optional(),secret:z.string().regex(/^[a-f0-9]{64}$/),invites:z.array(z.object({id:z.string().uuid(),hash:z.string().regex(/^[a-f0-9]{64}$/),status:z.enum(['unbound','bound','disabled']),boundAccountId:z.string().uuid().optional(),expiresAt:z.number().int().positive().nullable(),grantVersion:z.number().int().nonnegative().optional(),createdAt:z.number().nullable().optional(),batch:z.string().optional(),note:z.string().optional(),cipher:z.string().optional(),useCount:z.number().optional(),firstUsedAt:z.number().optional(),lastUsedAt:z.number().optional(),trackingSince:z.number().optional()})),audit:z.array(z.object({id:z.string(),at:z.number(),actor:z.string(),action:z.string(),target:z.string()})).optional()});
export type InviteConfig=z.infer<typeof configSchema>;
export const inviteHash=(code:string)=>createHash('sha256').update(code.trim().toUpperCase().replace(/[-\s]/g,'')).digest('hex');
export function generateInvites(count:number){
  const codes=Array.from({length:count},()=>`SY-${randomBytes(12).toString('hex').toUpperCase().match(/.{6}/g)!.join('-')}`);
  const config:InviteConfig={version:1,secret:randomBytes(32).toString('hex'),invites:codes.map(code=>({id:randomUUID(),hash:inviteHash(code),status:'unbound',expiresAt:null}))};
  return {config,codes};
}
const duration=7*86400_000;
export class InviteAccess {
  private attempts=new Map<string,{count:number;until:number}>();
  constructor(readonly file:string,private now=()=>Date.now()){}
  private async config(){
    try{return configSchema.parse(JSON.parse(await readFile(this.file,'utf8')));}
    catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return null;throw new Fault(503,'ACCESS_UNAVAILABLE','邀请验证暂不可用，请稍后重试。');}
  }
  async snapshot(){return this.config();}
  async update<T>(change:(data:InviteConfig)=>T|Promise<T>){return editJson(this.file,v=>configSchema.parse(v),change);}
  private valid(record:InviteConfig['invites'][number]){return record.status==='unbound'&&(record.expiresAt===null||record.expiresAt>this.now());}
  async status(token?:string){
    const config=await this.config();if(!config)return {available:false,authorized:false};
    return this.checkToken(token,config);
  }
  private checkToken(token:string|undefined,config:InviteConfig){
    if(!token||token.length>1024)return {available:config.invites.length>0,authorized:false};
    const [payload,signature,...extra]=token.split('.');
    if(extra.length||!signature||!/^[a-f0-9]{64}$/.test(signature))return {available:true,authorized:false};
    const expected=createHmac('sha256',config.secret).update(payload).digest();
    if(!timingSafeEqual(expected,Buffer.from(signature,'hex')))return {available:true,authorized:false};
    try{const data=JSON.parse(Buffer.from(payload,'base64url').toString());const record=config.invites.find(i=>i.id===data.inviteId);
      const authorized=!!record&&this.valid(record)&&data.scope==='invite-guest'&&(data.grantVersion||0)===(record.grantVersion||0)&&Number.isSafeInteger(data.expiresAt)&&data.expiresAt>this.now()&&data.expiresAt<=this.now()+duration;return {available:true,authorized,...(authorized?{inviteId:record!.id}:{})};
    }catch{return {available:true,authorized:false};}
  }
  async register(token:string|undefined,account:Omit<UserAccount,'inviteId'>){
    return this.update(config=>{
      const status=this.checkToken(token,config);if(!status.authorized||!('inviteId' in status))throw new Fault(403,'INVITE_REQUIRED','邀请码资格已失效，请重新验证。');
      if((config.users||[]).some(u=>u.username.normalize('NFKC').toLowerCase()===account.username.normalize('NFKC').toLowerCase()))throw new Fault(409,'USERNAME_TAKEN','这个用户名已被使用，请换一个。');
      const row=config.invites.find(i=>i.id===status.inviteId)!;
      const user={...account,inviteId:row.id};(config.users??=[]).push(user);row.status='bound';row.boundAccountId=user.id;row.grantVersion=(row.grantVersion||0)+1;
      (config.audit??=[]).push({id:randomUUID(),at:this.now(),actor:user.id,action:'邀请码绑定账号',target:row.id});return user;
    });
  }
  async verify(code:unknown,client:string,ip:string){
    const config=await this.config();if(!config||!config.invites.length)throw new Fault(503,'ACCESS_UNAVAILABLE','邀请码通道尚未配置，请联系邀请人。');
    for(const [key,bucket] of this.attempts)if(bucket.until<=this.now())this.attempts.delete(key);
    for(const [key,limit] of [[`client:${client}`,10],[`ip:${ip}`,60]] as const){
      const bucket=this.attempts.get(key)||{count:0,until:this.now()+15*60_000};
      if(bucket.count>=limit)throw new Fault(429,'ACCESS_RATE_LIMIT','尝试次数较多，请 15 分钟后再试。');
      bucket.count++;this.attempts.set(key,bucket);
    }
    if(typeof code!=='string'||code.length>128||!code.trim())throw new Fault(422,'INVALID_INVITE','请输入有效的邀请码。');
    const hash=inviteHash(code),record=config.invites.find(i=>timingSafeEqual(Buffer.from(i.hash,'hex'),Buffer.from(hash,'hex')));
    if(!record||!this.valid(record))throw new Fault(403,'INVALID_INVITE','邀请码无效或已失效，请检查后重试。');
    await this.update(data=>{const row=data.invites.find(i=>i.id===record.id);if(!row||!this.valid(row))throw new Fault(403,'INVALID_INVITE','邀请码无效或已失效。');row.useCount=(row.useCount||0)+1;row.firstUsedAt??=this.now();row.lastUsedAt=this.now();row.trackingSince??=this.now();});
    const expiresAt=Math.min(this.now()+duration,record.expiresAt??Infinity);
    const payload=Buffer.from(JSON.stringify({scope:'invite-guest',inviteId:record.id,grantVersion:record.grantVersion||0,expiresAt,nonce:randomBytes(16).toString('hex')})).toString('base64url');
    return {token:`${payload}.${createHmac('sha256',config.secret).update(payload).digest('hex')}`,maxAge:expiresAt-this.now()};
  }
}
