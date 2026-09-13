import { mkdir, open, readFile, rename,writeFile,unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { storeSchema, Fault,type StoreData } from '../shared/contracts.js';
import type { ObjectDocumentGroup } from './object-documents.js';
import type { TemporaryMedia } from './temporary-media.js';
export type ObjectTaskStorage={documents:ObjectDocumentGroup;media:TemporaryMedia};

// Reject unreadable state; never replace corrupt user/task data with an empty store.
export class Store {
  data: StoreData = { schemaVersion: 1, sessions: [], jobs: [], media: [] };
  private tail: Promise<unknown> = Promise.resolve();
  constructor(readonly directory: string,readonly objects?:ObjectTaskStorage) {}
  private get cell(){return this.objects?.documents.cell('segmentation',v=>storeSchema.parse(v));}
  async read(){return this.cell?this.cell.read():this.data;}
  async init() {
    if(this.cell){await this.cell.initialize(this.data);this.data=await this.cell.read();return;}
    await mkdir(join(this.directory, 'media'), { recursive: true, mode: 0o700 });
    try { this.data = storeSchema.parse(JSON.parse(await readFile(join(this.directory, 'state.json'), 'utf8'))); }
    catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('任务数据无法读取；已保留文件，服务停止以防覆盖。'); }
  }
  transaction<T>(fn: (draft: StoreData) => T | Promise<T>): Promise<T> {
    if(this.cell)return this.cell.update(fn);
    const operation = this.tail.then(async () => {
      const draft = structuredClone(this.data);
      const result = await fn(draft);
      storeSchema.parse(draft);
      const temp = join(this.directory, `.state-${randomUUID()}.tmp`);
      const file = await open(temp, 'wx', 0o600);
      try { await file.writeFile(JSON.stringify(draft)); await file.sync(); } finally { await file.close(); }
      await rename(temp, join(this.directory, 'state.json'));
      this.data = draft;
      return result;
    });
    this.tail = operation.catch(() => {});
    return operation;
  }
  mediaPath(id: string) {
    if(this.objects)throw Error('对象存储模式不能使用本机媒体路径。');
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error('Invalid media ID');
    return join(this.directory, 'media', `${id}.png`);
  }
  async putMedia(id:string,bytes:Buffer){if(this.objects)await this.objects.media.put(id,bytes);else await writeFile(this.mediaPath(id),bytes,{flag:'wx',mode:0o600});}
  async getMedia(id:string){try{return this.objects?await this.objects.media.get(id):await readFile(this.mediaPath(id));}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')throw new Fault(404,'NOT_FOUND','临时图片不存在或已过期。');throw e;}}
  async removeMedia(id:string){if(this.objects)await this.objects.media.remove(id);else await unlink(this.mediaPath(id)).catch(e=>{if(e.code!=='ENOENT')throw e;});}
}
