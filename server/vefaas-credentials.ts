import {AsyncLocalStorage} from 'node:async_hooks';
import type {IncomingHttpHeaders} from 'node:http';
import {connectTos} from './tos-client.js';
import type {TemporaryObjects} from './temporary-media.js';

// Only for the veFaaS-managed listener: these headers must be overwritten by
// the platform, never forwarded unchanged from a public reverse proxy.
// https://www.volcengine.com/docs/6662/1827370
export function vefaasCredentialEnv(headers:IncomingHttpHeaders):NodeJS.ProcessEnv{
  const read=(name:string)=>{
    const value=headers[name];
    if(typeof value!=='string'||!value.length||value.length>8192||/[^\x21-\x7e]/.test(value))throw Error('平台临时凭证缺失或无效。');
    return value;
  };
  return {SHIYE_TOS_ACCESS_KEY_ID:read('x-faas-access-key-id'),SHIYE_TOS_SECRET_ACCESS_KEY:read('x-faas-secret-access-key'),SHIYE_TOS_SECURITY_TOKEN:read('x-faas-session-token')};
}

export class VefaasTosScope implements TemporaryObjects{
  private storage=new AsyncLocalStorage<TemporaryObjects>();
  constructor(private env:NodeJS.ProcessEnv,private connect:(env:NodeJS.ProcessEnv)=>TemporaryObjects=e=>connectTos(e).objects){}
  run<T>(headers:IncomingHttpHeaders,fn:()=>T):T{
    // Never cache STS credentials on the shared service or mutate process.env.
    const objects=this.connect({...this.env,...vefaasCredentialEnv(headers)});
    return this.storage.run(objects,fn);
  }
  private current(){const objects=this.storage.getStore();if(!objects)throw Error('存储操作必须在平台请求内执行。');return objects;}
  async get(key:string){return this.current().get(key);}
  async put(key:string,bytes:Buffer,etag:string|null){return this.current().put(key,bytes,etag);}
  async removeTemporary(key:string){return this.current().removeTemporary(key);}
}
