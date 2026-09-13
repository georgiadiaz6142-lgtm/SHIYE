import { createHash } from 'node:crypto';
import { Fault } from '../shared/contracts.js';
import type { ConditionalObjects } from './object-documents.js';
import {tosErrorInfo} from './tos-error.js';

// Narrow interface of the official @volcengine/tos-sdk Node client. Credentials,
// endpoint, bounded timeouts and SDK initialization belong to the deployment layer.
export interface TosObjectClient {
  getObjectV2(input: { bucket: string; key: string; dataType: 'buffer' }): Promise<{ data: { content: Buffer; etag: string } }>;
  putObject(input: { bucket: string; key: string; body: Buffer; contentMD5: string; headers: Record<string, string> }): Promise<unknown>;
  deleteObject?(input:{bucket:string;key:string}):Promise<unknown>;
}
export class TosObjects implements ConditionalObjects {
  constructor(private client: TosObjectClient, private bucket: string, private prefix = 'shiye/') {
    if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket) || !/^[a-z0-9][a-z0-9/-]*\/$/.test(prefix) || prefix.includes('..')) throw Error('TOS 存储配置无效。');
  }
  private objectKey(key: string) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9/._-]*$/.test(key) || key.split('/').some(p => !p || p === '.' || p === '..')) throw Error('TOS 对象路径无效。');
    return this.prefix + key;
  }
  async get(key: string) {
    const objectKey = this.objectKey(key);
    try {
      const { data } = await this.client.getObjectV2({ bucket: this.bucket, key: objectKey, dataType: 'buffer' });
      if (!Buffer.isBuffer(data.content) || !data.etag) throw Error('format');
      return { bytes: data.content, etag: data.etag };
    } catch (error) {
      const e = await tosErrorInfo(error);
      if (e.statusCode === 404 && e.code === 'NoSuchKey') return null;
      throw new Fault(503, 'STORAGE_READ_FAILED', '云端数据暂时无法读取，请稍后重试。');
    }
  }
  async put(key: string, bytes: Buffer, expected: string | null) {
    const objectKey = this.objectKey(key);
    if (expected !== null && (!expected || /[\r\n]/.test(expected))) throw Error('TOS 对象版本无效。');
    try {
      await this.client.putObject({ bucket: this.bucket, key: objectKey, body: bytes,
        contentMD5: createHash('md5').update(bytes).digest('base64'),
        headers: { 'cache-control': 'no-store', ...(expected === null ? { 'if-none-match': '*' } : { 'if-match': expected }) },
      });
      return true;
    } catch (error) {
      const e = await tosErrorInfo(error);
      if (e.statusCode === 412 && (e.code === 'PreconditionFailed' || e.code === 'ConditionNotMet')) return false;
      // Do not replay a transaction after a timeout: the server may have committed it.
      throw new Fault(503, 'STORAGE_WRITE_UNCONFIRMED', '云端保存未能确认，请保留当前内容并查询或重试原操作。');
    }
  }
  async removeTemporary(key:string){
    if(!/^temporary\/[a-f0-9-]{36}\.bin$/.test(key)||!this.client.deleteObject)throw new Fault(503,'MEDIA_CLEANUP_UNAVAILABLE','临时图片清理尚未配置。');
    try{await this.client.deleteObject({bucket:this.bucket,key:this.objectKey(key)});}
    catch{throw new Fault(503,'MEDIA_CLEANUP_FAILED','临时图片清理未完成，将保留清理记录以便重试。');}
  }
}
