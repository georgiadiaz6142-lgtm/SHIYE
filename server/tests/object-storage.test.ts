import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import sharp from 'sharp';
import { ObjectDocumentGroup, type ConditionalObjects } from '../object-documents.js';
import { TosObjects, type TosObjectClient } from '../tos-objects.js';
import { ObjectWorkRepository, ObjectWorkObjects } from '../work-storage.js';
import { Works } from '../works.js';
import { Admin } from '../admin.js';
import {BaiduProvider} from '../baidu.js';
import { InviteAccess, generateInvites, configSchema } from '../access.js';
import { Fault } from '../../shared/contracts.js';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createApp } from '../app.js';

// Test double with atomic, server-side preconditions. Each consumer below has an
// independent repository/group/Admin; no application queue serializes writers.
class ObjectService implements ConditionalObjects {
  values = new Map<string, { bytes: Buffer; etag: string }>();
  conflicts = 0;
  loseNextReply = false;
  async get(key: string) { const row = this.values.get(key); return row ? { ...row, bytes: Buffer.from(row.bytes) } : null; }
  async put(key: string, bytes: Buffer, expected: string | null) {
    const old = this.values.get(key);
    if ((old?.etag ?? null) !== expected) { this.conflicts++; return false; }
    this.values.set(key, { bytes: Buffer.from(bytes), etag: randomUUID() });
    if (this.loseNextReply) { this.loseNextReply = false; throw new Fault(503, 'STORAGE_WRITE_UNCONFIRMED', '模拟写入成功但响应丢失'); }
    return true;
  }
}
const failure = (type: string) => (e: unknown) => e instanceof Fault && e.errorType === type;

test('independent document writers retry definite conflicts; nested changes commit together or roll back', async () => {
  const service = new ObjectService();
  const group = () => new ObjectDocumentGroup(service, 'identity/state.json');
  const cell = (g: ObjectDocumentGroup) => g.cell('counter', v => z.object({ count: z.number() }).parse(v));
  const first = group(); await cell(first).initialize({ count: 0 });
  await Promise.all(Array.from({ length: 6 }, () => cell(group()).update(s => { s.count++; })));
  assert.equal((await cell(group()).read()).count, 6); assert.ok(service.conflicts > 0);
  await assert.rejects(first.transaction(async () => {
    await cell(first).update(s => { s.count = 99; });
    await first.cell('second', v => z.number().parse(v)).initialize(5);
    throw Error('abort');
  }));
  assert.equal((await cell(group()).read()).count, 6);
  await assert.rejects(first.cell('second', v => z.number().parse(v)).read(), { code: 'ENOENT' });
});

test('document bounds, corruption and unknown write outcomes preserve explicit recovery semantics', async () => {
  const service = new ObjectService(), group = new ObjectDocumentGroup(service, 'state.json', 200);
  const cell = group.cell('text', v => z.object({ value: z.string() }).parse(v)); await cell.initialize({ value: 'original' });
  await assert.rejects(cell.update(s => { s.value = 'x'.repeat(1000); }), failure('STORAGE_DOCUMENT_LIMIT'));
  assert.equal((await cell.read()).value, 'original');
  service.loseNextReply = true; let calls = 0;
  await assert.rejects(cell.update(s => { calls++; s.value = 'committed'; }), failure('STORAGE_WRITE_UNCONFIRMED'));
  assert.equal(calls, 1); assert.equal((await cell.read()).value, 'committed');
  service.values.set('state.json', { bytes: Buffer.from('{broken'), etag: 'bad' });
  await assert.rejects(cell.initialize({ value: 'reset' }), failure('STORAGE_INVALID'));
  assert.equal(service.values.get('state.json')!.bytes.toString(), '{broken');
});

test('TOS adapter sends target preconditions, distinguishes missing keys from errors and redacts provider errors', async () => {
  const calls: Parameters<TosObjectClient['putObject']>[0][] = [];
  let error: unknown;
  const client: TosObjectClient = {
    async getObjectV2() { if (error) throw error; return { data: { content: Buffer.from('data'), etag: 'etag' } }; },
    async putObject(input) { calls.push(input); if (error) throw error; },
  };
  const objects = new TosObjects(client, 'shiye-test');
  assert.equal(await objects.put('identity/state.json', Buffer.from('x'), null), true);
  assert.equal(calls[0].headers['if-none-match'], '*'); assert.equal(calls[0].key, 'shiye/identity/state.json');
  await objects.put('identity/state.json', Buffer.from('x'), 'etag'); assert.equal(calls[1].headers['if-match'], 'etag');
  error = { statusCode: 412, code: 'PreconditionFailed' }; assert.equal(await objects.put('state.json', Buffer.from('x'), 'old'), false);
  error = { statusCode: 404, code: 'NoSuchKey' }; assert.equal(await objects.get('missing'), null);
  for (const code of ['NoSuchBucket', 'AccessDenied']) {
    error = { statusCode: 404, code, message: 'secret-sentinel' };
    await assert.rejects(objects.get('missing'), e => failure('STORAGE_READ_FAILED')(e) && !String(e).includes('secret-sentinel'));
  }
  error = new Error('secret-sentinel'); await assert.rejects(objects.put('state.json', Buffer.from('x'), null), failure('STORAGE_WRITE_UNCONFIRMED'));
  await assert.rejects(objects.get('../outside'));
});

async function identityFixture() {
  const service = new ObjectService(), key = randomBytes(32), batch = generateInvites(8);
  const initial = { username: '宋静雯', password: 'synthetic-admin-password-123' };
  const group = () => new ObjectDocumentGroup(service, 'identity/state.json');
  await group().cell('invites', v => configSchema.parse(v)).initialize(batch.config);
  const instance = async (encryptionKey = key,factory?:ConstructorParameters<typeof Admin>[2]) => {
    const documents = group(), access = new InviteAccess('/not-used/invites.json', undefined, documents);
    const admin = new Admin('/not-used/admin.json', access, factory, { documents, encryptionKey });
    await admin.init({ apiKey: 'synthetic-api', secretKey: 'synthetic-secret', cutout: false, naming: false }, initial);
    return { admin, access };
  };
  return { service, batch, initial, instance };
}

test('two application instances atomically bind one invitation and reject duplicate usernames', async () => {
  const f = await identityFixture(), a = await f.instance(), b = await f.instance();
  const grant = await a.access.verify(f.batch.codes[0], 'a', 'a');
  const results = await Promise.allSettled([a.admin.register(grant.token, { username: 'alice', password: 'synthetic-user-password' }), b.admin.register(grant.token, { username: 'bob', password: 'synthetic-user-password' })]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  const snapshot = (await b.access.snapshot())!; assert.equal(snapshot.users!.length, 1);
  assert.equal(snapshot.invites[0].boundAccountId, snapshot.users![0].id); assert.equal((await b.access.status(grant.token)).authorized, false);
  const [g1, g2] = await Promise.all([a.access.verify(f.batch.codes[1], 'c', 'c'), b.access.verify(f.batch.codes[2], 'd', 'd')]);
  const names = await Promise.allSettled([a.admin.register(g1.token, { username: 'same-name', password: 'synthetic-user-password' }), b.admin.register(g2.token, { username: 'SAME-NAME', password: 'synthetic-user-password' })]);
  assert.equal(names.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal((await a.access.snapshot())!.invites.filter(i => i.status === 'bound').length, 2);
});

test('stored sessions survive rebuilding instances; logout and password changes invalidate all other instances', async () => {
  const f = await identityFixture(), a = await f.instance();
  const token = await a.admin.login(f.initial.username, f.initial.password, 'a');
  const b = await f.instance(); assert.equal((await b.admin.resolveSession(token))!.role, 'admin');
  await b.admin.logout(token); assert.equal(await a.admin.resolveSession(token), null);
  const grant = await a.access.verify(f.batch.codes[0], 'b', 'b');
  const user = await a.admin.register(grant.token, { username: 'ordinary', password: 'synthetic-user-password' });
  const one = await a.admin.login(user.username, 'synthetic-user-password', 'c'), two = await b.admin.login(user.username, 'synthetic-user-password', 'd');
  assert.equal((await b.admin.resolveSession(one))!.accountId, user.id);
  await assert.rejects(b.admin.login(user.username, 'synthetic-user-password', 'e', true), failure('ADMIN_LOGIN_FAILED'));
  await b.admin.updateProfile(two, { username: 'renamed', currentPassword: 'synthetic-user-password' });
  assert.equal((await a.admin.resolveSession(one))!.username, 'renamed');
  await a.admin.setPassword(user.id, 'synthetic-user-password', 'new-synthetic-user-password');
  assert.equal(await b.admin.resolveSession(one), null); assert.equal(await b.admin.resolveSession(two), null);
  await assert.rejects(f.instance(randomBytes(32)));
  const raw = f.service.values.get('identity/state.json')!.bytes.toString();
  for (const secret of [f.initial.password, 'synthetic-user-password', one, two, 'synthetic-api']) assert.ok(!raw.includes(secret));
});

test('administrator rename racing registration cannot claim the same username', async () => {
  const f = await identityFixture(), a = await f.instance(), b = await f.instance();
  const token = await a.admin.login(f.initial.username, f.initial.password, 'a'), grant = await b.access.verify(f.batch.codes[0], 'b', 'b');
  const results = await Promise.allSettled([a.admin.updateProfile(token, { username: 'target-name', currentPassword: f.initial.password }), b.admin.register(grant.token, { username: 'target-name', password: 'synthetic-user-password' })]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
});

test('password and invitation guessing limits survive instance changes, and failed logins remain audited', async () => {
  const f = await identityFixture(), a = await f.instance(), b = await f.instance();
  for (let i = 0; i < 8; i++) await assert.rejects((i % 2 ? a : b).admin.login(f.initial.username, 'wrong', 'same-client'), failure('ADMIN_LOGIN_FAILED'));
  const c = await f.instance(); await assert.rejects(c.admin.login(f.initial.username, f.initial.password, 'same-client'), failure('ADMIN_RATE_LIMIT'));
  assert.equal((await c.admin.logs()).filter(row => row.action === '账号登录失败').length, 8);
  for (let i = 0; i < 10; i++) await assert.rejects((i % 2 ? a : b).access.verify('bad-code', 'same-client', 'invite-ip'), failure('INVALID_INVITE'));
  await assert.rejects(c.access.verify(f.batch.codes[0], 'same-client', 'invite-ip'), failure('ACCESS_RATE_LIMIT'));
});

test('object work repositories preserve editable content, isolate owners and reject stale saves; lost replies remain idempotent', async () => {
  const service = new ObjectService(), owner = randomUUID(), imageId = randomUUID(), bookId = randomUUID();
  const instance = () => new Works(new ObjectWorkRepository(service), new ObjectWorkObjects(service), async () => true);
  const a = instance(), b = instance();
  const image = await sharp({ create: { width: 8, height: 8, channels: 4, background: '#556655' } }).png().toBuffer();
  await Promise.all([a.upload(owner, imageId, image), b.upload(owner, imageId, image)]);
  const content = { schemaVersion: 1, book: { id: bookId, title: '云端手账', cover: 'olive', page: 0, pages: [{ id: 'page-1', paper: 'plain', elements: [{ id: 'text-1', type: 'text', text: '仍可编辑', x: 10, y: 20, w: 40, size: 23, rotation: 0, font: 'serif', color: '#556655' }] }] }, assets: [] };
  const input = { operationId: randomUUID(), baseRevision: 0, content };
  const saves = await Promise.all([a.save(owner, bookId, input), b.save(owner, bookId, input)]); assert.deepEqual(saves[0], saves[1]);
  const racing = await Promise.allSettled(['first', 'second'].map((title, i) => [a, b][i].save(owner, bookId, { operationId: randomUUID(), baseRevision: 1, content: { ...content, book: { ...content.book, title } } })));
  assert.equal(racing.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal((racing.find(r => r.status === 'rejected') as PromiseRejectedResult).reason.errorType, 'WORK_REVISION_CONFLICT');
  const next = { operationId: randomUUID(), baseRevision: 2, content };
  service.loseNextReply = true; await assert.rejects(a.save(owner, bookId, next), failure('STORAGE_WRITE_UNCONFIRMED'));
  assert.equal((await b.save(owner, bookId, next)).revision, 3);
  assert.equal((await instance().get(owner, bookId)).content.book.pages[0].elements[0].type, 'text');
  assert.deepEqual(await b.list(randomUUID()), []); await assert.rejects(b.image(randomUUID(), imageId), failure('WORK_IMAGE_NOT_FOUND'));
  const hash = createHash('sha256').update(await b.image(owner, imageId)).digest('hex');
  service.values.get(`works/${owner}/images/${hash}.png`)!.bytes = Buffer.from('corrupt');
  await assert.rejects(a.image(owner, imageId), failure('WORK_IMAGE_UNAVAILABLE'));
});

test('HTTP routes resolve shared sessions across two servers and enforce logout, roles and work ownership', async () => {
  const f = await identityFixture();
  const servers: ReturnType<Awaited<ReturnType<typeof createApp>>['app']['listen']>[] = [];
  try {
    const bases: string[] = [];
    for (let i = 0; i < 2; i++) {
      const identity = await f.instance(), runtime = await mkdtemp(join(tmpdir(), 'shiye-object-http-'));
      const { app } = await createApp({ ...identity, runtime, staticRoot: resolve('shiye-editorial-prototype'), workStorage: { repository: new ObjectWorkRepository(f.service), objects: new ObjectWorkObjects(f.service) } });
      const server = app.listen(0, '127.0.0.1'); servers.push(server);
      await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
      bases.push(`http://127.0.0.1:${(server.address() as { port: number }).port}`);
    }
    const initial = await fetch(bases[0] + '/api/access/session');
    let cookie = initial.headers.getSetCookie()[0].split(';')[0];
    const request = (i: number, path: string, value?: unknown, extra?: Record<string, string>) => fetch(bases[i] + path, { method: value === undefined ? 'GET' : 'POST', headers: { origin: bases[i], cookie, 'content-type': 'application/json', ...extra }, ...(value === undefined ? {} : { body: JSON.stringify(value) }) });
    const login = await request(0, '/api/access/login', f.initial); assert.equal(login.status, 200);
    cookie += '; ' + login.headers.getSetCookie().find(s => s.startsWith('shiye_admin='))!.split(';')[0];
    assert.equal((await (await request(1, '/api/account')).json()).account.role, 'admin');
    assert.equal((await request(1, '/api/admin/overview')).status, 200);
    assert.equal((await request(1, '/api/account/logout', {})).status, 200);
    assert.equal((await request(0, '/api/account')).status, 401);
    assert.equal((await request(0, '/api/works/books')).status, 401);
    const identity = await f.instance(), grant = await identity.access.verify(f.batch.codes[0], 'x', 'x');
    await identity.admin.register(grant.token, { username: 'http-user', password: 'synthetic-user-password' });
    const userLogin = await request(0, '/api/access/login', { username: 'http-user', password: 'synthetic-user-password' });
    cookie = cookie.split(';')[0] + '; ' + userLogin.headers.getSetCookie().find(s => s.startsWith('shiye_admin='))!.split(';')[0];
    assert.equal((await request(1, '/api/admin/overview')).status, 403);
    assert.equal((await request(1, '/api/works/books')).status, 200);
    assert.equal((await request(1, '/api/works/books', undefined, { 'x-shiye-work-account': randomUUID() })).status, 409);
  } finally { await Promise.all(servers.map(server => new Promise<void>((resolve, reject) => { server.close(e => e ? reject(e) : resolve()); server.closeAllConnections(); }))); }
});

test('API connection proof survives instance replacement and stale concurrent saves still conflict',async()=>{
  const f=await identityFixture();
  const a=await f.instance(undefined,(key,secret)=>new BaiduProvider(key,secret,async()=>new Response(JSON.stringify({access_token:'synthetic-token',expires_in:3600}))));
  const token=await a.admin.login(f.initial.username,f.initial.password,'fixture');
  const candidate={apiKey:'new-synthetic-key',secretKey:'new-synthetic-secret',enabled:true,revision:0};
  await a.admin.testApi('admin',token,'cutout',candidate);
  const b=await f.instance(),c=await f.instance();
  await assert.rejects(b.admin.saveApi('admin',token,'cutout',{...candidate,secretKey:'changed'}),/先测试/);
  const results=await Promise.allSettled([b.admin.saveApi('admin',token,'cutout',candidate),c.admin.saveApi('admin',token,'cutout',candidate)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal((await a.admin.apiList())[0].revision,1);
  assert.ok(!f.service.values.get('identity/state.json')!.bytes.toString().includes(candidate.secretKey));
});
