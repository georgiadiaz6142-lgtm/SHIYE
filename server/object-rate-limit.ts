import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { ObjectDocumentGroup } from './object-documents.js';
import { Fault } from '../shared/contracts.js';
const schema = z.record(z.string(), z.object({ count: z.number().int().nonnegative(), until: z.number() }));
const key = (value: string) => createHash('sha256').update(value).digest('hex');
export class ObjectAttemptLimits {
  constructor(private documents: ObjectDocumentGroup, private name: string) {}
  private get cell() { return this.documents.cell(this.name, v => schema.parse(v)); }
  async take(limits: [string, number][], now: number) {
    await this.cell.initialize({});
    return this.cell.update(rows => {
      for (const [k, row] of Object.entries(rows)) if (row.until <= now) delete rows[k];
      if (limits.some(([id, max]) => (rows[key(id)]?.count ?? 0) >= max)) return false;
      if (Object.keys(rows).length + limits.length > 10000) throw new Fault(503, 'ACCESS_BUSY', '登录请求较多，请稍后重试。');
      for (const [id] of limits) { const row = rows[key(id)] ??= { count: 0, until: now + 900000 }; row.count++; }
      return true;
    });
  }
  async clear(id: string) { await this.cell.update(rows => { delete rows[key(id)]; }); }
}
