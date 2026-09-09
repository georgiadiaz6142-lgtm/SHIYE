import { mkdir, open, readFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { storeSchema, type StoreData } from '../shared/contracts.js';

// Reject unreadable state; never replace corrupt user/task data with an empty store.
export class Store {
  data: StoreData = { schemaVersion: 1, sessions: [], jobs: [], media: [] };
  private tail: Promise<unknown> = Promise.resolve();
  constructor(readonly directory: string) {}
  async init() {
    await mkdir(join(this.directory, 'media'), { recursive: true, mode: 0o700 });
    try { this.data = storeSchema.parse(JSON.parse(await readFile(join(this.directory, 'state.json'), 'utf8'))); }
    catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('任务数据无法读取；已保留文件，服务停止以防覆盖。'); }
  }
  transaction<T>(fn: (draft: StoreData) => T | Promise<T>): Promise<T> {
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
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error('Invalid media ID');
    return join(this.directory, 'media', `${id}.png`);
  }
}
