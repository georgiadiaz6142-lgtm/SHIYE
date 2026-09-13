import {setTimeout as delay} from 'node:timers/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { Fault } from '../shared/contracts.js';
import { Jobs } from './jobs.js';

export interface NamingProvider { name(image:Buffer):Promise<{name:string;requestId:string}> }
export class Naming {
  private pending=new Map<string,Promise<string>>();
  constructor(private jobs:Jobs,private provider?:NamingProvider) {}
  async suggest(owner:string,sessionId:string,candidateId:string,revision:number,bytes:Buffer):Promise<string> {
    const s=await this.jobs.readSession(owner,sessionId),candidate=s.candidates.find(c=>c.candidateId===candidateId&&c.candidateRevision===revision);
    if(!candidate)throw new Fault(409,'STALE_CANDIDATE','贴纸版本已改变。');
    if(!this.provider)return '照片贴纸';
    this.jobs.assertLive();
    const source=sharp(bytes,{limitInputPixels:1_048_576,failOn:'warning'}),meta=await source.metadata();
    if(!['png','jpeg'].includes(meta.format||'')||(meta.pages||1)!==1)throw new Fault(422,'INVALID_IMAGE','名称识别需要静态图片。');
    // Only the final sticker thumbnail is handled; never load the original photo here.
    const image=await source.rotate().resize(640,640,{fit:'contain',background:'#ffffff'}).flatten({background:'#ffffff'}).jpeg({quality:85}).toBuffer();
    const key=createHash('sha256').update([owner,sessionId,candidateId,revision].join(':')).update(image).digest('hex');
    const current=this.pending.get(key);if(current)return current;
    const operation=this.run(owner,sessionId,key,s.expiresAt,image);
    this.pending.set(key,operation);
    try{return await operation;}finally{this.pending.delete(key);}
  }
  private async run(owner:string,imageSessionId:string,key:string,expiresAt:number,image:Buffer) {
    const store=this.jobs.store;
    const cached=await store.transaction(d=>{
      const previous=d.naming?.find(n=>n.key===key);
      if(previous)return previous.name||'照片贴纸';
      if([...this.pending.keys()].length>4||store.objects&&(d.naming||[]).filter(n=>n.status==='attempted'&&n.attemptedAt>Date.now()-120000).length>=4)throw new Fault(429,'NAMING_BUSY','名称识别繁忙。');
      (d.naming??=[]).push({key,owner,imageSessionId,expiresAt,attemptedAt:Date.now(),status:'attempted'});
      return null;
    });
    if(cached!==null)return cached;
    try{
      const result=await this.provider!.name(image);
      const name=result.name.trim().slice(0,30)||'照片贴纸';
      for(let attempt=0;;attempt++){try{await store.transaction(d=>{const record=d.naming!.find(n=>n.key===key)!;if(record.status==='attempted')Object.assign(record,{status:'succeeded',name,providerRequestId:result.requestId});});break;}catch(e){if(attempt>=2)throw e;await delay(20*(attempt+1));}}
      return name;
    }catch{
      await store.transaction(d=>{const record=d.naming!.find(n=>n.key===key)!;if(record.status==='attempted')record.status='failed';});
      return '照片贴纸';
    }
  }
}
