import {Readable} from 'node:stream';

type TosErrorInfo = {statusCode?:number;code?:string};
const decoded=new WeakMap<object,Promise<TosErrorInfo>>();

// The Node SDK downloads as a stream, including non-2xx error bodies.
// Parse only a bounded provider error code; never expose its raw body.
export function tosErrorInfo(error:unknown):Promise<TosErrorInfo>{
  if(!error||typeof error!=='object')return Promise.resolve({});
  const cached=decoded.get(error);if(cached)return cached;
  const result=decode(error);decoded.set(error,result);return result;
}
async function decode(error:object):Promise<TosErrorInfo>{
  const e=error as {statusCode?:unknown;code?:unknown;data?:unknown};
  const statusCode=typeof e.statusCode==='number'?e.statusCode:undefined;
  const valid=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_.-]{1,80}$/.test(v);
  if(valid(e.code))return {statusCode,code:e.code};
  let data=e.data;
  try{
    if(data instanceof Readable){
      const stream=data,chunks:Buffer[]=[];let size=0;
      const timer=setTimeout(()=>stream.destroy(Error('TOS error body timeout')),2000);timer.unref();
      try{for await(const chunk of stream){const bytes=Buffer.from(chunk);size+=bytes.length;if(size>16384)throw Error('TOS error body too large');chunks.push(bytes);}data=Buffer.concat(chunks);}
      finally{clearTimeout(timer);stream.destroy();}
    }
    if(Buffer.isBuffer(data)){if(data.length>16384)return {statusCode};data=data.toString('utf8');}
    if(typeof data==='string'){if(Buffer.byteLength(data)>16384)return {statusCode};data=JSON.parse(data);}
    const code=data&&typeof data==='object'?(data as {Code?:unknown}).Code:undefined;
    return {statusCode,...(valid(code)?{code}:{})};
  }catch{return {statusCode};}
}
