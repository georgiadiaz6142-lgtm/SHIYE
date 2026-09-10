import sharp from 'sharp';
import {DEFAULT_COPY_PROMPT} from './copy-prompt.js';
import { z } from 'zod';
import { Fault } from '../shared/contracts.js';
import { copyUsage,type CopyInput,type CopyUsage } from '../shared/ai-copy.js';
export const ARK_COPY_ENDPOINT='https://ark.cn-beijing.volces.com/api/v3/chat/completions';
export type CopyResult={text:string;provider:'ark'|'test';model:string;usage?:CopyUsage;requestId?:string};
export interface CopyProvider {generate(input:CopyInput,signal:AbortSignal):Promise<CopyResult>}
export class CopyProviderFault extends Fault {constructor(status:number,type:string,message:string,readonly usage?:CopyUsage,readonly requestId?:string){super(status,type,message);}}
export async function validateCopyThumbnail(input:CopyInput){
 if(!input.thumbnail)return;
 try{const bytes=Buffer.from(input.thumbnail.split(',')[1],'base64');if(bytes.length>150000)throw Error('size');const image=sharp(bytes,{limitInputPixels:512*512,failOn:'warning'}),m=await image.metadata();if(m.format!=='jpeg'||!m.width||!m.height||m.width>512||m.height>512||(m.pages||1)!==1)throw Error('size');await image.raw().toBuffer();}
 catch{throw new Fault(422,'COPY_THUMBNAIL_INVALID','当前页缩略图无法读取，请重新打开文案面板。');}
}
export function copyMessages(input:CopyInput,prompt=DEFAULT_COPY_PROMPT){
 const tone={natural:'自然记录',gentle:'温柔手账',concise:'简短克制'}[input.tone];
 return [{role:'system',content:prompt},
 {role:'user',content:[{type:'text',text:JSON.stringify({task:input.mode==='polish'?'润色草稿':'写一段手账文字',tone,topic:input.topic,draft:input.draft,date:input.date,place:input.place,mood:input.mood})},...(input.thumbnail?[{type:'image_url',image_url:{url:input.thumbnail}}]:[])]}];
}
export class ArkCopyProvider implements CopyProvider {
 constructor(private key:string,private model:string,private request:typeof fetch=fetch,private prompt=DEFAULT_COPY_PROMPT){}
 async generate(input:CopyInput,signal:AbortSignal):Promise<CopyResult>{
  let response:Response;
  try{response=await this.request(ARK_COPY_ENDPOINT,{method:'POST',headers:{Authorization:'Bearer '+this.key,'Content-Type':'application/json'},body:JSON.stringify({model:this.model,messages:copyMessages(input,this.prompt),stream:false,max_tokens:512,response_format:{type:'json_object'}}),signal,redirect:'error'});}
  catch{throw new CopyProviderFault(504,signal.aborted?'COPY_TIMEOUT':'COPY_NETWORK_FAILED',signal.aborted?'文案生成超时，本次不扣使用次数。请查询原任务后再决定是否重新生成。':'文案服务连接失败，本次不扣使用次数。');}
  if(!response.ok){const type=response.status===401||response.status===403?'COPY_CREDENTIALS_INVALID':response.status===429?'COPY_PROVIDER_LIMIT':'COPY_PROVIDER_FAILED';throw new CopyProviderFault(502,type,type==='COPY_CREDENTIALS_INVALID'?'文案服务配置或权限有误，请联系管理员。':type==='COPY_PROVIDER_LIMIT'?'文案服务繁忙或供应商额度不足，请稍后再试。':'文案服务未完成请求，本次不扣使用次数。');}
  const text=await response.text();if(text.length>65536)throw new CopyProviderFault(502,'COPY_RESULT_INVALID','文案结果过大，本次不扣使用次数。');
  let data:any;try{data=JSON.parse(text);}catch{throw new CopyProviderFault(502,'COPY_RESULT_INVALID','文案结果格式异常，本次不扣使用次数。');}
  const usage=copyUsage.safeParse({inputTokens:data.usage?.prompt_tokens,outputTokens:data.usage?.completion_tokens}),requestId=typeof data.id==='string'&&/^[\w.-]{1,120}$/.test(data.id)?data.id:undefined;
  try{
   const choice=data.choices?.[0];if(choice?.finish_reason!=='stop'||typeof choice.message?.content!=='string')throw Error('incomplete');
   const result=z.object({text:z.string().trim().min(1).max(800)}).strict().parse(JSON.parse(choice.message.content));
   if(/<\/?[a-z][^>]*>/i.test(result.text))throw Error('markup');
   return {...result,provider:'ark',model:this.model,...(usage.success?{usage:usage.data}:{}),...(requestId?{requestId}:{})};
  }catch{throw new CopyProviderFault(502,'COPY_RESULT_INVALID','没有收到有效文案，本次不扣使用次数。',usage.success?usage.data:undefined,requestId);}
 }
}
