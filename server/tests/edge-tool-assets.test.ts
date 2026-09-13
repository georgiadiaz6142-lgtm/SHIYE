import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { mkdtemp, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { createApp } from '../app.js';

test('OpenCV transport preserves bytes, negotiates gzip and caches only the matching version', async t => {
  const runtime = await mkdtemp(join(tmpdir(), 'shiye-edge-assets-'));
  const { app } = await createApp({ runtime, staticRoot: resolve('shiye-editorial-prototype') });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(r => server.once('listening', r));
  t.after(() => new Promise<void>(r => server.close(() => r())));
  const port = (server.address() as { port: number }).port;
  const get = (path: string, headers: Record<string, string> = {}, method = 'GET') => new Promise<{status:number;headers:import('node:http').IncomingHttpHeaders;body:Buffer}>((done, reject) => {
    const req = request({ hostname:'127.0.0.1',port,path,headers,method }, res => {
      const chunks:Buffer[]=[];
      res.on('data', chunk => chunks.push(chunk));res.on('error',reject);
      res.on('end',()=>done({status:res.statusCode!,headers:res.headers,body:Buffer.concat(chunks)}));
    });req.on('error',reject);req.end();
  });
  const path = '/vendor/opencv-4.13.0/opencv.js';
  const source = await readFile(resolve('shiye-editorial-prototype', '.'+path));
  const version = createHash('sha256').update(source).digest('hex').slice(0,12);
  const pinned = path+'?v='+version;
  const [plain, zipped] = await Promise.all([get(pinned),get(pinned,{'accept-encoding':'gzip'})]);
  assert.equal(plain.status,200);assert.equal(zipped.status,200);
  assert.deepEqual(plain.body,source);assert.deepEqual(gunzipSync(zipped.body),source);
  assert.ok(zipped.body.length < source.length * .6, 'compression must materially reduce transfer');
  assert.equal(zipped.headers['content-encoding'],'gzip');assert.equal(plain.headers['content-encoding'],undefined);
  assert.match(String(zipped.headers['content-type']),/javascript/);
  assert.match(String(zipped.headers.vary),/Accept-Encoding/);
  assert.equal(zipped.headers['cache-control'],'public, max-age=31536000, immutable');
  assert.notEqual(plain.headers.etag,zipped.headers.etag);
  const cached=await get(pinned,{'accept-encoding':'gzip','if-none-match':String(zipped.headers.etag)});
  assert.equal(cached.status,304);assert.equal(cached.body.length,0);
  const head=await get(pinned,{'accept-encoding':'gzip'},'HEAD');
  assert.equal(head.status,200);assert.equal(head.body.length,0);assert.equal(Number(head.headers['content-length']),zipped.body.length);
  const refused=await get(pinned,{'accept-encoding':'gzip;q=0'});
  assert.equal(refused.headers['content-encoding'],undefined);assert.deepEqual(refused.body,source);
  for(const url of [path,path+'?v=stale'])assert.equal((await get(url)).headers['cache-control'],'public, max-age=0');
  assert.equal((await get('/.env.local')).status,404);
  assert.equal((await get('/api/health')).headers['cache-control'],'no-store');
});
