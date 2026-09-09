import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,writeFile,readFile} from 'node:fs/promises';import {join,resolve} from 'node:path';import {tmpdir} from 'node:os';
import {Admin} from '../admin.js';import {InviteAccess,generateInvites} from '../access.js';import {BaiduProvider} from '../baidu.js';import {createApp} from '../app.js';
async function setup(){const dir=await mkdtemp(join(tmpdir(),'shiye-admin-')),file=join(dir,'invites.json'),batch=generateInvites(2);await writeFile(file,JSON.stringify(batch.config));const access=new InviteAccess(file);let calls=0;const admin=new Admin(join(dir,'admin.json'),access,(key,secret)=>new BaiduProvider(key,secret,async()=>{calls++;if(key==='bad')return new Response(JSON.stringify({error:'invalid'}));return new Response(JSON.stringify({access_token:'test-token',expires_in:3600}));}));await admin.init({apiKey:'original-key',secretKey:'original-secret',cutout:true,naming:false},join(dir,'credentials.txt'));const password=(await readFile(join(dir,'credentials.txt'),'utf8')).match(/密码：(.+)/)![1];return {dir,access,admin,batch,password,calls:()=>calls};}
test('admin login is separate, invite history and revocation persist, sensitive records remain encrypted',async()=>{
 const s=await setup(),grant=await s.access.verify(s.batch.codes[0],'user','local');await s.admin.migrateInvites(s.batch.codes);let rows=await s.admin.invites();assert.equal(rows.length,2);assert.equal(rows[0].useCount,1);assert.equal(rows[0].state,'used');assert.equal(rows[1].state,'unknown');assert.ok(!JSON.stringify(rows).includes(s.batch.codes[0]));
 const token=await s.admin.login('admin',s.password,'local');assert.ok(s.admin.session(token));assert.equal(s.admin.session(grant.token),null);
 const created=await s.admin.createInvites('admin',{count:2,batch:'测试批次',note:'内部验证',expiresAt:null});const revealed=await s.admin.reveal('admin',created.ids);assert.equal(revealed.length,2);await s.access.verify(revealed[0].code,'second','local');rows=await s.admin.invites();assert.equal(rows.find(r=>r.id===created.ids[0])!.useCount,1);
 await s.admin.setInvite('admin',rows[0].id,true);assert.equal((await s.access.status(grant.token)).authorized,false);await s.admin.setInvite('admin',rows[0].id,false);assert.equal((await s.access.status(grant.token)).authorized,false);assert.equal((await s.access.status((await s.access.verify(s.batch.codes[0],'user','local')).token)).authorized,true);
 const disk=await readFile(s.access.file,'utf8');assert.ok(!disk.includes(s.batch.codes[0]));assert.ok(!disk.includes(revealed[0].code));assert.ok(!disk.includes('original-secret'));assert.ok((await s.admin.logs()).some(x=>x.action==='停用邀请码'));
 const fresh=new InviteAccess(s.access.file);assert.equal((await fresh.snapshot())!.invites.length,4);await s.admin.changePassword('admin',s.password,'new-test-password-123');assert.equal(s.admin.session(token),null);await assert.rejects(s.admin.login('admin',s.password,'local'),/不正确/);assert.ok(await s.admin.login('admin','new-test-password-123','local'));
});
test('API changes require a matching successful test, retain old configuration on failure, and reject stale saves',async()=>{
 const s=await setup(),token=await s.admin.login('admin',s.password,'local'),candidate={apiKey:'new-key',secretKey:'new-secret',enabled:true,revision:0};
 await assert.rejects(s.admin.saveApi('admin',token,'cutout',candidate),/先测试/);await assert.rejects(s.admin.testApi('admin',token,'cutout',{...candidate,apiKey:'bad'}),/鉴权/);assert.equal((await s.admin.apiList())[0].revision,0);
 await s.admin.testApi('admin',token,'cutout',candidate);await assert.rejects(s.admin.saveApi('admin',token,'cutout',{...candidate,secretKey:'changed-after-test'}),/先测试/);await s.admin.saveApi('admin',token,'cutout',candidate);assert.equal((await s.admin.apiList())[0].revision,1);await assert.rejects(s.admin.saveApi('admin',token,'cutout',candidate),/更新/);
 const disk=await readFile(join(s.dir,'admin.json'),'utf8');assert.ok(!disk.includes('new-secret'));assert.ok(!disk.includes(s.password));assert.ok(!JSON.stringify(await s.admin.apiList()).includes('new-secret'));
 await s.admin.saveApi('admin',token,'cutout',{apiKey:'',secretKey:'',enabled:false,revision:1});assert.equal(await s.admin.apiEnabled('cutout'),false);assert.equal(s.calls(),2);
});
test('HTTP administrator permissions, cookie protection, CSRF and logout are enforced by server',async()=>{
 const s=await setup(),{app}=await createApp({runtime:join(s.dir,'runtime'),staticRoot:resolve('shiye-editorial-prototype'),admin:s.admin,access:s.access}),server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
 try{const headers={origin:base,'content-type':'application/json',cookie:''};
 assert.equal((await fetch(base+'/admin')).status,200);assert.equal((await fetch(base+'/api/admin/overview')).status,403);assert.equal((await fetch(base+'/api/admin/invites',{method:'POST',headers,body:'{}'})).status,403);
 const user=await fetch(base+'/api/access/session');headers.cookie=user.headers.get('set-cookie')!.split(';')[0];const invite=await fetch(base+'/api/access/invite/verify',{method:'POST',headers,body:JSON.stringify({code:s.batch.codes[0],role:'admin'})});headers.cookie+='; '+invite.headers.get('set-cookie')!.split(';')[0];assert.equal((await fetch(base+'/api/admin/apis',{headers})).status,403);
 const login=await fetch(base+'/api/admin/login',{method:'POST',headers,body:JSON.stringify({username:'admin',password:s.password})});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie')!;assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Strict/);headers.cookie=cookie.split(';')[0];assert.equal((await fetch(base+'/api/admin/overview',{headers})).status,200);
 const publicStatus=await (await fetch(base+'/api/access/session',{headers})).json();assert.equal(publicStatus.role,'admin');assert.equal(publicStatus.authorized,true);
 assert.equal((await fetch(base+'/api/admin/invites',{method:'POST',headers:{...headers,origin:'https://foreign.example'},body:'{}'})).status,403);assert.equal((await fetch(base+'/admin.json',{headers})).status,404);
 await fetch(base+'/api/admin/logout',{method:'POST',headers,body:'{}'});assert.equal((await fetch(base+'/api/admin/overview',{headers})).status,403);
 }finally{await new Promise<void>(r=>server.close(()=>r()));}
});
test('entering with an invitation revokes the previous administrator session instead of inheriting its role',async()=>{
 const s=await setup(),{app}=await createApp({runtime:join(s.dir,'runtime'),staticRoot:resolve('shiye-editorial-prototype'),admin:s.admin,access:s.access}),server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
 try{
  const owner=(await fetch(base+'/api/access/session')).headers.getSetCookie()[0].split(';')[0];
  const headers={origin:base,'content-type':'application/json',cookie:owner};
  const login=await fetch(base+'/api/admin/login',{method:'POST',headers,body:JSON.stringify({username:'admin',password:s.password})});
  assert.ok(login.headers.getSetCookie().some(c=>c.startsWith('shiye_invite=;')));
  const adminCookie=login.headers.getSetCookie()[0].split(';')[0];headers.cookie+='; '+adminCookie;
  const invalid=await fetch(base+'/api/access/invite/verify',{method:'POST',headers,body:JSON.stringify({code:'invalid'})});assert.equal(invalid.status,403);assert.equal((await fetch(base+'/api/admin/overview',{headers})).status,200);
  const enter=await fetch(base+'/api/access/invite/verify',{method:'POST',headers,body:JSON.stringify({code:s.batch.codes[0],role:'admin',username:'宋静雯'})});assert.equal(enter.status,200);assert.ok(enter.headers.getSetCookie().some(c=>c.startsWith('shiye_admin=;')));
  // Even replaying the old admin cookie must fail after the browser changes identity.
  assert.equal((await fetch(base+'/api/admin/overview',{headers})).status,403);
  headers.cookie=owner+'; '+enter.headers.getSetCookie()[0].split(';')[0];
  const status=await (await fetch(base+'/api/access/session',{headers})).json();assert.equal(status.authorized,true);assert.notEqual(status.role,'admin');
  assert.equal((await (await fetch(base+'/api/admin/session',{headers})).json()).authenticated,false);
  for(const route of ['overview','invites','apis','audit'])assert.equal((await fetch(base+'/api/admin/'+route,{headers})).status,403);
 }finally{await new Promise<void>(r=>server.close(()=>r()));}
});
test('persisted Chinese administrator username replaces the old login without changing the password or API credentials',async()=>{
 const s=await setup(),file=join(s.dir,'admin.json'),data=JSON.parse(await readFile(file,'utf8'));data.username='宋静雯';await writeFile(file,JSON.stringify(data));
 const admin=new Admin(file,s.access);await admin.init({apiKey:'ignored',secretKey:'ignored',cutout:false,naming:true},join(s.dir,'credentials.txt'));
 await assert.rejects(admin.login('admin',s.password,'local'),/不正确/);
 const token=await admin.login('宋静雯',s.password,'local');assert.equal(admin.session(token)?.username,'宋静雯');assert.equal(await admin.apiEnabled('cutout'),true);assert.equal(await admin.apiEnabled('naming'),false);
});
