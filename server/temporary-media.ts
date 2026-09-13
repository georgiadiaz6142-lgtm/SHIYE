import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { ConditionalObjects } from './object-documents.js';
import { Fault } from '../shared/contracts.js';
export interface TemporaryMedia {
  put(id:string,bytes:Buffer):Promise<void>;
  get(id:string):Promise<Buffer>;
  remove(id:string):Promise<void>;
}
export interface TemporaryObjects extends ConditionalObjects { removeTemporary(key:string):Promise<void> }
export class ObjectTemporaryMedia implements TemporaryMedia {
  constructor(private objects:TemporaryObjects){}
  private key(id:string){return `temporary/${z.string().uuid().parse(id)}.bin`;}
  async put(id:string,bytes:Buffer){
    const payload=Buffer.concat([Buffer.from(createHash('sha256').update(bytes).digest('hex')),bytes]);
    if(await this.objects.put(this.key(id),payload,null))return;
    if(!(await this.get(id)).equals(bytes))throw new Fault(503,'MEDIA_CONFLICT','临时图片校验失败，未覆盖原图片。');
  }
  async get(id:string){
    const object=await this.objects.get(this.key(id));
    if(!object)throw new Fault(404,'NOT_FOUND','临时图片不存在或已过期。');
    const bytes=object.bytes.subarray(64);
    if(object.bytes.length<64||createHash('sha256').update(bytes).digest('hex')!==object.bytes.subarray(0,64).toString())throw new Fault(503,'MEDIA_CORRUPT','临时图片校验失败，请重新上传。');
    return bytes;
  }
  async remove(id:string){await this.objects.removeTemporary(this.key(id));}
}
