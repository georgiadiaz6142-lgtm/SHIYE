import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { Fault } from '../shared/contracts.js';

export interface ConditionalObjects {
  // null means NoSuchKey only; permission/network/bucket errors must throw.
  get(key: string): Promise<{ bytes: Buffer; etag: string } | null>;
  // null requires an absent key; string requires the exact current ETag.
  // false means a definite failed precondition. Unknown write outcomes must throw.
  put(key: string, bytes: Buffer, expected: string | null): Promise<boolean>;
}
export interface JsonCell<T> {
  read(): Promise<T>;
  initialize(value: T): Promise<void>;
  update<R>(change: (value: T) => R | Promise<R>): Promise<R>;
}
type Envelope = { version: 1; commit: string; values: Record<string, unknown> };
type Context = { data: Envelope; dirty: boolean; active: boolean };
const missing = () => Object.assign(new Error('数据尚未初始化。'), { code: 'ENOENT' });

/** One object is one atomic unit. Callbacks may run again after a conflict:
 * no AI calls, emails, token publication or other irreversible effects inside.
 * Nested cells share the same snapshot; this is NOT a cross-object transaction.
 */
export class ObjectDocumentGroup {
  private context = new AsyncLocalStorage<Context>();
  constructor(private objects: ConditionalObjects, private key: string, private maxBytes = 24 * 1024 * 1024, private attempts = 8) {}

  private async load() {
    const object = await this.objects.get(this.key);
    if (!object) return { data: { version: 1, commit: randomUUID(), values: {} } as Envelope, etag: null };
    if (!object.etag || object.bytes.length > this.maxBytes) throw new Fault(503, 'STORAGE_INVALID', '保存数据校验失败，未覆盖原内容。');
    let data: Envelope;
    try {
      data = JSON.parse(object.bytes.toString('utf8'));
      if (data?.version !== 1 || typeof data.commit !== 'string' || !data.values || typeof data.values !== 'object' || Array.isArray(data.values)) throw Error('format');
    } catch { throw new Fault(503, 'STORAGE_INVALID', '保存数据无法读取，未覆盖原内容。'); }
    return { data, etag: object.etag };
  }

  async transaction<R>(change: () => Promise<R>): Promise<R> {
    const nested = this.context.getStore();
    if (nested) { if (!nested.active) throw Error('存储事务已结束。'); return change(); }
    for (let attempt = 0; attempt < this.attempts; attempt++) {
      const { data, etag } = await this.load();
      const ctx = { data, dirty: false, active: true };
      let result: R;
      try { result = await this.context.run(ctx, change); } finally { ctx.active = false; }
      if (!ctx.dirty) return result;
      data.commit = randomUUID(); // never reuse a revision, including after restoring old content
      const bytes = Buffer.from(JSON.stringify(data));
      if (bytes.length > this.maxBytes) throw new Fault(413, 'STORAGE_DOCUMENT_LIMIT', '保存数据超过当前容量限制，请联系管理员；已有内容未覆盖。');
      if (await this.objects.put(this.key, bytes, etag)) return result;
      await delay(Math.min(100, 5 * 2 ** attempt) + Math.floor(Math.random() * 10));
    }
    throw new Fault(409, 'STORAGE_BUSY', '数据正被其他操作更新，请稍后重试；未覆盖其他人的修改。');
  }

  cell<T>(name: string, parse: (value: unknown) => T): JsonCell<T> {
    if (!/^[a-z][a-z0-9-]*$/.test(name)) throw Error('无效的数据分区。');
    const context = () => { const ctx = this.context.getStore(); if (!ctx?.active) throw Error('存储事务未开启。'); return ctx; };
    return {
      read: () => this.transaction(async () => {
        const values = context().data.values;
        if (!Object.hasOwn(values, name)) throw missing();
        return structuredClone(parse(values[name]));
      }),
      initialize: value => this.transaction(async () => {
        const ctx = context();
        if (Object.hasOwn(ctx.data.values, name)) { parse(ctx.data.values[name]); return; }
        ctx.data.values[name] = structuredClone(parse(value)); ctx.dirty = true;
      }),
      update: change => this.transaction(async () => {
        const ctx = context();
        if (!Object.hasOwn(ctx.data.values, name)) throw missing();
        const draft = structuredClone(parse(ctx.data.values[name]));
        const result = await change(draft);
        ctx.data.values[name] = structuredClone(parse(draft)); ctx.dirty = true;
        return result;
      }),
    };
  }
}
