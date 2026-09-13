import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { runtimeConfig } from '../runtime-config.js';
import { createApp } from '../app.js';
import { Admin } from '../admin.js';
import { InviteAccess, generateInvites } from '../access.js';
import { LocalWorkRepository, LocalWorkObjects } from '../work-storage.js';

const origin = 'https://shiye.example.test';
const initial = { username: '测试管理员', password: 'isolated-test-password-123' };
const api = { apiKey: '', secretKey: '', cutout: false, naming: false };

test('deployment configuration fails closed and preserves local defaults', () => {
  const local = runtimeConfig({});
  assert.equal(local.host, '127.0.0.1');assert.equal(local.port, 4176);assert.equal(local.origin, undefined);
  assert.throws(() => runtimeConfig({ SHIYE_HOST: '0.0.0.0' }), /监听/);
  assert.throws(() => runtimeConfig({ SHIYE_DEPLOYMENT: 'production' }), /持久化/);
  assert.throws(() => runtimeConfig({ SHIYE_PUBLIC_ORIGIN: origin }), /本机模式/);
  const cloud = { SHIYE_DEPLOYMENT: 'cloud-test', SHIYE_PUBLIC_ORIGIN: origin, SHIYE_RUNTIME_DIR: join(tmpdir(), 'disposable-shiye'), SHIYE_INITIAL_ADMIN_USERNAME: initial.username, SHIYE_INITIAL_ADMIN_PASSWORD: initial.password, SHIYE_ALLOW_EPHEMERAL_TEST_DATA: 'true' };
  assert.equal(runtimeConfig(cloud).host, '0.0.0.0');assert.equal(runtimeConfig(cloud).port, 3000);
  for (const value of ['', 'http://shiye.example.test', origin+'/', origin+'/path', origin+'?x=y', origin+'#hash', 'https://user:password@shiye.example.test']) {
    assert.throws(() => runtimeConfig({ ...cloud, SHIYE_PUBLIC_ORIGIN: value }), /HTTPS/);
  }
  assert.throws(() => runtimeConfig({ ...cloud, SHIYE_RUNTIME_DIR: '.local/shiye' }), /绝对/);
  assert.throws(() => runtimeConfig({ ...cloud, SHIYE_ALLOW_EPHEMERAL_TEST_DATA: '' }), /可丢弃/);
  assert.throws(() => runtimeConfig({ ...cloud, SHIYE_INITIAL_ADMIN_PASSWORD: '' }), /初始管理员/);
});

test('deployment administrator initialization writes no plaintext receipt and does not overwrite an existing identity', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'shiye-bootstrap-test-'));
  const access = new InviteAccess(join(dir, 'invites.json'));
  const admin = new Admin(join(dir, 'admin.json'), access);
  await admin.init(api, initial);
  assert.deepEqual((await readdir(dir)).sort(), ['admin.json', 'admin.json.key']);
  assert.ok(!(await readFile(admin.file, 'utf8')).includes(initial.password));
  const first = admin.session(await admin.login(initial.username, initial.password, 'test'))!;
  const restored = new Admin(admin.file, access);
  await restored.init(api, { username: '另一个名字', password: 'another-test-password-123' });
  const second = restored.session(await restored.login(initial.username, initial.password, 'test'))!;
  assert.equal(second.accountId, first.accountId);assert.equal(second.username, initial.username);
  await assert.rejects(restored.login('另一个名字', 'another-test-password-123', 'test'), /不正确/);
});

test('gateway-style requests enforce public Host/Origin, secure cookies, authorization and revocation', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'shiye-public-http-test-'));
  const batch = generateInvites(1), file = join(dir, 'invites.json');
  await writeFile(file, JSON.stringify(batch.config));
  const access = new InviteAccess(file), admin = new Admin(join(dir, 'admin.json'), access);
  await admin.init(api, initial);
  const repository = new LocalWorkRepository(join(dir, 'separate-metadata'));
  const owners: string[] = [], read = repository.read.bind(repository);
  repository.read = async owner => { owners.push(owner); return read(owner); };
  const { app } = await createApp({ runtime: join(dir, 'runtime'), staticRoot: resolve('shiye-editorial-prototype'), publicOrigin: origin, admin, access,
    workStorage: { repository, objects: new LocalWorkObjects(join(dir, 'separate-images')) } });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(r => server.once('listening', r));
  t.after(() => new Promise<void>(r => server.close(() => r())));
  const port = (server.address() as { port: number }).port;
  // Simulate HTTP from a TLS-terminating gateway; this does not claim real HTTPS verification.
  const call = (path: string, method = 'GET', body?: unknown, extra: Record<string, string> = {}) => new Promise<{status:number;cookies:string[];body:any} >((done, reject) => {
    const req = request({ hostname: '127.0.0.1', port, path, method, headers: { host: new URL(origin).host, ...(method==='GET'?{}:{origin}), 'content-type':'application/json', ...extra } }, res => {
      const chunks: Buffer[] = [];
      res.on('data', b => chunks.push(b));res.on('error', reject);
      res.on('end', () => { const raw=Buffer.concat(chunks).toString();done({status:res.statusCode!,cookies:res.headers['set-cookie']||[],body:res.headers['content-type']?.includes('application/json')?JSON.parse(raw):raw}); });
    });
    req.on('error', reject);req.end(body===undefined?undefined:JSON.stringify(body));
  });
  assert.equal((await call('/')).status, 200);
  assert.equal((await call('/', 'GET', undefined, {'sec-fetch-site':'cross-site','sec-fetch-mode':'navigate','sec-fetch-dest':'document'})).status, 200);
  assert.equal((await call('/index.html', 'GET', undefined, {'sec-fetch-site':'cross-site','sec-fetch-mode':'navigate','sec-fetch-dest':'document'})).status, 200);
  assert.equal((await call('/', 'GET', undefined, {'sec-fetch-site':'cross-site'})).status, 200);
  assert.equal((await call('/', 'GET', undefined, {'sec-fetch-site':'cross-site','sec-fetch-mode':'cors'})).status, 403);
  assert.equal((await call('/', 'GET', undefined, {origin:'https://foreign.example','sec-fetch-site':'cross-site','sec-fetch-mode':'navigate','sec-fetch-dest':'document'})).status, 403);
  assert.equal((await call('/api/health')).status, 200);
  const rejectedHeaders:Record<string,string>[] = [{host:'evil.example'}, {host:'evil.example','x-forwarded-host':new URL(origin).host}, {origin:'https://foreign.example'}, {origin:'null'}, {'sec-fetch-site':'cross-site'}];
  for (const headers of rejectedHeaders) {
    assert.equal((await call('/api/access/session','GET',undefined,headers)).status, 403);
  }
  assert.equal((await call('/api/access/session','GET',undefined,{'sec-fetch-site':'cross-site','sec-fetch-mode':'navigate','sec-fetch-dest':'document'})).status, 403);
  assert.equal((await call('/api/access/login','POST',initial,{origin:''})).status,403);
  assert.equal((await call('/api/access/login','POST',initial,{origin:'http://shiye.example.test','x-forwarded-proto':'https'})).status,403);
  const secure = (cookies:string[]) => {assert.ok(cookies.length);for(const cookie of cookies){assert.match(cookie,/; Secure/);assert.match(cookie,/; HttpOnly/);assert.match(cookie,/SameSite=Strict/);assert.match(cookie,/Path=\/api/);assert.doesNotMatch(cookie,/Domain=/);}};
  const guest=await call('/api/access/session');secure(guest.cookies);
  const guestCookie=guest.cookies[0].split(';')[0];
  const invited=await call('/api/access/invite/verify','POST',{code:batch.codes[0]},{cookie:guestCookie});assert.equal(invited.status,200);secure(invited.cookies);
  const grant=invited.cookies.find(c=>c.startsWith('shiye_invite='))!.split(';')[0];
  const registered=await call('/api/account/register','POST',{username:'ordinary-user',password:'ordinary-test-password-123'},{cookie:guestCookie+'; '+grant});assert.equal(registered.status,200);secure(registered.cookies);
  const userCookie=guestCookie+'; '+registered.cookies.find(c=>c.startsWith('shiye_admin='))!.split(';')[0];
  assert.equal((await call('/api/admin/overview','GET',undefined,{cookie:userCookie})).status,403);
  const loggedOut=await call('/api/account/logout','POST',{}, {cookie:userCookie});assert.equal(loggedOut.status,200);secure(loggedOut.cookies);
  assert.equal((await call('/api/account','GET',undefined,{cookie:guestCookie+'; '+userCookie})).status,401);
  const login=await call('/api/access/login','POST',initial);assert.equal(login.status,200);secure(login.cookies);
  const adminCookie=login.cookies.find(c=>c.startsWith('shiye_admin='))!.split(';')[0];
  assert.equal((await call('/api/admin/overview','GET',undefined,{cookie:adminCookie})).status,200);
  const books=await call('/api/works/books','GET',undefined,{cookie:guestCookie+'; '+adminCookie});
  assert.equal(books.status,200);assert.deepEqual(books.body.books,[]);
  assert.deepEqual(owners,[login.body.account.id]);
  assert.ok(!(await readdir(join(dir,'runtime'))).includes('works-dev'));
  const changed=await call('/api/admin/password','POST',{oldPassword:initial.password,newPassword:'changed-admin-password-123'},{cookie:adminCookie});assert.equal(changed.status,200);secure(changed.cookies);
  assert.equal((await call('/api/admin/overview','GET',undefined,{cookie:adminCookie})).status,403);
  for(const path of ['/.env.local','/admin.json','/server/index.ts','/checkpoint-before-desk-20260907.tar.gz'])assert.equal((await call(path)).status,404);
});
