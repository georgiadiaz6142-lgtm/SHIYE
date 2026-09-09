import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import sharp from 'sharp';
import {Admin} from '../admin.js';
import {InviteAccess,generateInvites} from '../access.js';
import {createApp} from '../app.js';
async function fixture(){const dir=await mkdtemp(join(tmpdir(),'shiye-profile-')),batch=generateInvites(3),file=join(dir,'invites.json');await writeFile(file,JSON.stringify(batch.config));const access=new InviteAccess(file),admin=new Admin(join(dir,'admin.json'),access);await admin.init({apiKey:'test',secretKey:'test',cutout:false,naming:false},join(dir,'receipt'));return {dir,batch,access,admin,password:(await readFile(join(dir,'receipt'),'utf8')).match(/密码：(.+)/)![1]};}
test('invite registration atomically binds a single ordinary account; credentials and profile persist with unique names',async()=>{
 const s=await fixture(),grant=await s.access.verify(s.batch.codes[0],'a','local'),input={username:'普通用户',password:'ordinary-password-123'};
 const attempts=await Promise.allSettled([s.admin.register(grant.token,input),s.admin.register(grant.token,{...input,username:'另一个用户'})]);assert.equal(attempts.filter(r=>r.status==='fulfilled').length,1);
 const created=(attempts.find(r=>r.status==='fulfilled') as PromiseFulfilledResult<any>).value;assert.equal(created.role,'user');assert.equal((await s.access.status(grant.token)).authorized,false);assert.equal((await s.access.snapshot())!.invites[0].boundAccountId,created.id);
 await assert.rejects(s.access.verify(s.batch.codes[0],'b','local'));
 const token=await s.admin.login(created.username,input.password,'browser1'),other=await s.admin.login(created.username,input.password,'browser2');assert.equal(s.admin.session(token)!.accountId,s.admin.session(other)!.accountId);
 await assert.rejects(s.admin.login(created.username,input.password,'browser',true));
 const avatar='data:image/png;base64,'+(await sharp({create:{width:400,height:300,channels:3,background:'#cc8866'}}).png().toBuffer()).toString('base64');
 await s.admin.updateProfile(token,{avatar});assert.match((await s.admin.profile(token)).avatar!,/^data:image\/png;base64,/);
 await assert.rejects(s.admin.updateProfile(token,{username:'renamed-user',currentPassword:'wrong'}));
 await s.admin.updateProfile(token,{username:'renamed-user',currentPassword:input.password});await assert.rejects(s.admin.login(created.username,input.password,'browser'));assert.equal(s.admin.session(other)!.username,'renamed-user');
 await assert.rejects(s.admin.updateProfile(token,{username:'ADMIN',currentPassword:input.password}),/已被使用/);
 await s.admin.setPassword(created.id,input.password,'changed-password-123');assert.equal(s.admin.session(token),null);assert.equal(s.admin.session(other),null);await assert.rejects(s.admin.login('renamed-user',input.password,'browser'));
 const fresh=new Admin(s.admin.file,new InviteAccess(s.access.file));await fresh.init({apiKey:'ignored',secretKey:'ignored',cutout:false,naming:false},join(s.dir,'receipt'));const restored=await fresh.profile(await fresh.login('renamed-user','changed-password-123','new-browser'));assert.equal(restored.id,created.id);assert.ok(restored.avatar);
 const file=await readFile(s.access.file,'utf8');assert.ok(!file.includes(input.password));assert.ok(!file.includes('changed-password-123'));
});
test('ordinary accounts cannot use administrator endpoints; profile updates reject foreign IDs and avatar scripts',async()=>{
 const s=await fixture(),{app}=await createApp({runtime:join(s.dir,'runtime'),staticRoot:resolve('shiye-editorial-prototype'),admin:s.admin,access:s.access}),server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
 try{
  const owner=(await fetch(base+'/api/access/session')).headers.getSetCookie()[0].split(';')[0],headers={origin:base,'content-type':'application/json',cookie:owner};
  const post=(path:string,body:unknown)=>fetch(base+path,{method:'POST',headers,body:JSON.stringify(body)});
  assert.equal((await post('/api/account/register',{username:'normal',password:'ordinary-password-123'})).status,403);
  const invite=await post('/api/access/invite/verify',{code:s.batch.codes[0]});headers.cookie+='; '+invite.headers.getSetCookie()[0].split(';')[0];assert.equal((await (await fetch(base+'/api/account',{headers})).json()).canSetCredentials,true);
  assert.equal((await post('/api/account/register',{username:'normal',password:'ordinary-password-123',role:'admin'})).status,422);
  const registered=await post('/api/account/register',{username:'normal',password:'ordinary-password-123'});assert.equal(registered.status,200);headers.cookie=owner+'; '+registered.headers.getSetCookie()[0].split(';')[0];
  const account=(await registered.json()).account;assert.equal(account.role,'user');assert.equal((await (await fetch(base+'/api/admin/session',{headers})).json()).authenticated,false);
  for(const path of ['overview','invites','apis','audit'])assert.equal((await fetch(base+'/api/admin/'+path,{headers})).status,403);
  assert.equal((await post('/api/account/profile',{accountId:'foreign',username:'hacked'})).status,422);assert.equal((await post('/api/account/profile',{avatar:'data:image/svg+xml,<svg onload="alert(1)"/>'})).status,422);
  assert.equal((await post('/api/admin/login',{username:'normal',password:'ordinary-password-123'})).status,401);
  const photo=await (await post('/api/uploads/photo/init',{operationId:crypto.randomUUID(),fixture:true})).json();
  const grantB=await s.access.verify(s.batch.codes[1],'b','local');await s.admin.register(grantB.token,{username:'second-user',password:'second-password-123'});
  const tokenB=await s.admin.login('second-user','second-password-123','b');
  const other=await (await fetch(base+'/api/session',{headers:{cookie:owner+'; shiye_admin='+tokenB}})).json();assert.equal(other.session,null);
  const sameAccount=await s.admin.login('normal','ordinary-password-123','new-browser');
  const freshOwner=(await fetch(base+'/api/access/session')).headers.getSetCookie()[0].split(';')[0];
  const restored=await (await fetch(base+'/api/session',{headers:{cookie:freshOwner+'; shiye_admin='+sameAccount}})).json();assert.equal(restored.session.imageSessionId,photo.imageSessionId);
  await post('/api/account/logout',{});assert.equal((await fetch(base+'/api/account',{headers})).status,401);
 }finally{await new Promise<void>(r=>server.close(()=>r()));}
});
test('administrator profile edits preserve administrator ID and allow the new username and password at both login entry points',async()=>{
 const s=await fixture(),token=await s.admin.login('admin',s.password,'local'),id=s.admin.session(token)!.accountId;
 await s.admin.updateProfile(token,{username:'管理员新名',currentPassword:s.password});assert.equal(s.admin.session(token)!.accountId,id);assert.equal((await s.admin.profile(token)).role,'admin');
 await s.admin.setPassword(id,s.password,'admin-new-password-123');assert.equal(s.admin.session(token),null);assert.equal(s.admin.session(await s.admin.login('管理员新名','admin-new-password-123','local',true))!.accountId,id);
 const g=await s.access.verify(s.batch.codes[1],'a','local');await assert.rejects(s.admin.register(g.token,{username:'管理员新名',password:'ordinary-password-123'}),/已被使用/);
});
