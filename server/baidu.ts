import sharp from 'sharp';
import { Fault, type Box } from '../shared/contracts.js';

const AUTH = 'https://aip.baidubce.com/oauth/2.0/token';
const SEGMENT = 'https://aip.baidubce.com/rest/2.0/image-process/v1/segment';
export interface SegmentationProvider {
  segment(source: Buffer, box?: Box): Promise<{mask: Buffer; requestId: string}>;
}

export function pixelBox(box: Box, width: number, height: number) {
  const x1=Math.max(1,Math.round(box.x*width)), y1=Math.max(1,Math.round(box.y*height));
  const x2=Math.min(width-1,Math.round((box.x+box.width)*width)), y2=Math.min(height-1,Math.round((box.y+box.height)*height));
  if(x2-x1<10||y2-y1<10)throw new Fault(422,'INVALID_BOX','请框出至少 10 × 10 像素的主体范围。');
  return [[[x1,y1],[x2,y2]]];
}

// No constructor/startup/health network traffic. Endpoints cannot be supplied by the browser.
export class BaiduProvider implements SegmentationProvider {
  private token?: {value:string; expiresAt:number};
  constructor(private apiKey:string, private secretKey:string, private transport:typeof fetch=fetch, private timeout=30_000) {}
  private async json(url:string, body:string|URLSearchParams, signal:AbortSignal, limit:number) {
    try {
      const res=await this.transport(url,{method:'POST',redirect:'error',signal,
        headers:{'Content-Type':typeof body==='string'?'application/json':'application/x-www-form-urlencoded'},body});
      if(!res.ok){await res.body?.cancel();throw new Fault(502,'PROVIDER_HTTP_ERROR','百度请求未完成，请核对控制台记录后再试。');}
      if(Number(res.headers.get('content-length'))>limit){await res.body?.cancel();throw new Fault(502,'INVALID_PROVIDER_RESPONSE','百度返回内容超过限制。');}
      const chunks:Uint8Array[]=[];let length=0;
      if(!res.body)throw new Error('empty');
      for await(const chunk of res.body){length+=chunk.length;if(length>limit)throw new Fault(502,'INVALID_PROVIDER_RESPONSE','百度返回内容超过限制。');chunks.push(chunk);}
      // Preserve uint64 log_id exactly instead of rounding it through a JS number.
      const text=Buffer.concat(chunks).toString('utf8').replace(/("log_id"\s*:\s*)(\d+)(?=\s*[,}])/g,'$1"$2"');
      const value:unknown=JSON.parse(text);
      if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('shape');
      return value as Record<string,unknown>;
    }catch(e){
      if(e instanceof Fault)throw e;
      throw new Fault(502,signal.aborted?'PROVIDER_TIMEOUT':'PROVIDER_REQUEST_FAILED',signal.aborted?'百度请求超时；处理和计费状态未知，不会自动重试。':'百度请求未完成；不会自动重试，请核对控制台记录。');
    }
  }
  async segment(source:Buffer, box?:Box) {
    const meta=await sharp(source,{limitInputPixels:24_000_000}).metadata();
    const width=meta.width!,height=meta.height!,image=source.toString('base64');
    if(Math.min(width,height)<128||Math.max(width,height)>3000||image.length>10_000_000)
      throw new Fault(422,'PROVIDER_IMAGE_LIMIT','图片需满足百度尺寸和编码大小限制，请使用较小图片。');
    const position=box?pixelBox(box,width,height):undefined;
    if(!this.apiKey.trim()||!this.secretKey.trim())throw new Fault(503,'MODEL_NOT_CONFIGURED','百度密钥尚未配置。');
    const signal=AbortSignal.timeout(this.timeout);
    if(!this.token||this.token.expiresAt<=Date.now()){
      const auth=await this.json(AUTH,new URLSearchParams({grant_type:'client_credentials',client_id:this.apiKey,client_secret:this.secretKey}),signal,64_000);
      if(typeof auth.access_token!=='string'||!auth.access_token||auth.access_token.length>8192||typeof auth.expires_in!=='number'||auth.expires_in<=0)
        throw new Fault(503,'PROVIDER_AUTH_FAILED','百度鉴权未通过，请在本地核对两项密钥及应用权限。');
      this.token={value:auth.access_token,expiresAt:Date.now()+Math.min(auth.expires_in,2_592_000)*1000-60_000};
    }
    const result=await this.json(SEGMENT+'?access_token='+encodeURIComponent(this.token.value),JSON.stringify({image,method:box?'control':'auto',return_form:'mask',refine_mask:'true',...(position?{position}:{})}),signal,16_000_000);
    if(result.error_code!==undefined){
      if(result.error_code===110||result.error_code===111)this.token=undefined;
      throw new Fault(502,'PROVIDER_REJECTED','百度未返回可用结果，请核对应用权限、额度及调用记录；不会自动重试。');
    }
    if(typeof result.log_id!=='string'||!/^\d{1,20}$/.test(result.log_id)||typeof result.image!=='string'||!result.image.length||result.image.length%4!==0||! /^[A-Za-z0-9+/]*={0,2}$/.test(result.image))
      throw new Fault(502,'INVALID_PROVIDER_RESPONSE','百度返回的蒙版格式无效。');
    try {
      const bytes=Buffer.from(result.image,'base64'),m=await sharp(bytes,{limitInputPixels:24_000_000}).metadata();
      if(m.format!=='png'||m.width!==width||m.height!==height||(m.pages||1)!==1)throw new Error('mask dimensions');
      const decoded=await sharp(bytes).toColourspace('srgb').ensureAlpha().raw().toBuffer();
      for(let i=0;i<decoded.length;i+=4)if(decoded[i]!==decoded[i+1]||decoded[i]!==decoded[i+2]||decoded[i+3]!==255)throw new Error('not a grayscale mask');
      const mask=await sharp(bytes).removeAlpha().greyscale().png().toBuffer();
      return {mask,requestId:result.log_id};
    }catch{throw new Fault(502,'INVALID_MASK','百度蒙版无法解码、不是灰度蒙版或尺寸不匹配。');}
  }
}
