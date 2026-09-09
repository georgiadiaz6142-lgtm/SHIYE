import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,writeFile } from 'node:fs/promises';
import { join,resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { InviteAccess,generateInvites } from '../access.js';
import { createApp } from '../app.js';

async function setup(){const dir=await mkdtemp(join(tmpdir(),'shiye-invite-')),file=join(dir,'invites.json'),batch=generateInvites(2);await writeFile(file,JSON.stringify(batch.config),{mode:0o600});return {dir,file,...batch};}
test('invite grant survives restart, hides code, rejects tampering and expires',async()=>{
 const s=await setup();let now=Date.now();const access=new InviteAccess(s.file,()=>now);
 const grant=await access.verify(s.codes[0],'browser','local');assert.equal((await new InviteAccess(s.file,()=>now).status(grant.token)).authorized,true);
 assert.ok(!grant.token.includes(s.codes[0]));assert.ok(!JSON.stringify(s.config).includes(s.codes[0]));
 assert.equal((await access.status(grant.token+'x')).authorized,false);assert.equal((await access.status(grant.token.replace(/^./,'!'))).authorized,false);
 now+=8*86400_000;assert.equal((await access.status(grant.token)).authorized,false);
});
test('disabled, bound and expired invite records revoke existing grants immediately',async()=>{
 const s=await setup(),access=new InviteAccess(s.file),grant=await access.verify(s.codes[0],'a','ip');
 for(const status of ['disabled','bound','unbound'] as const){s.config.invites[0].status=status;s.config.invites[0].expiresAt=status==='unbound'?Date.now()-1:null;await writeFile(s.file,JSON.stringify(s.config));assert.equal((await access.status(grant.token)).authorized,false);await assert.rejects(access.verify(s.codes[0],'b','ip'),/无效或已失效/);}
});
test('bad codes cannot pass; client and IP throttles reject repeated guesses',async()=>{
 const s=await setup(),access=new InviteAccess(s.file);for(let i=0;i<10;i++)await assert.rejects(access.verify('WRONG','a','ip'),/无效/);await assert.rejects(access.verify(s.codes[0],'a','ip'),/15 分钟/);
 for(let i=0;i<50;i++)await assert.rejects(access.verify('WRONG',String(i),'ip'),/无效/);await assert.rejects(access.verify(s.codes[0],'new-client','ip'),/15 分钟/);
});
test('missing or damaged configuration fails closed',async()=>{const s=await setup();assert.deepEqual(await new InviteAccess(join(s.dir,'absent.json')).status(),{available:false,authorized:false});await writeFile(s.file,'{broken');await assert.rejects(new InviteAccess(s.file).status(),/暂不可用/);});
test('HTTP invite gate requires real verification, protects jobs, and does not expose phone login or config',async()=>{
 const s=await setup(),{app}=await createApp({runtime:join(s.dir,'runtime'),staticRoot:resolve('shiye-editorial-prototype'),access:new InviteAccess(s.file)}),server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
 try{
 const start=await fetch(base+'/api/access/session'),cookie=start.headers.get('set-cookie')!.split(';')[0];assert.equal((await start.json()).authorized,false);
 const headers={origin:base,cookie,'content-type':'application/json'};
 assert.equal((await fetch(base+'/api/session',{headers})).status,401);
 assert.equal((await fetch(base+'/api/segmentation/jobs',{method:'POST',headers,body:'{}'})).status,401);
 const denied=await fetch(base+'/api/access/invite/verify',{method:'POST',headers,body:JSON.stringify({code:'wrong'})});assert.equal(denied.status,403);
 assert.equal((await fetch(base+'/api/access/invite/verify',{method:'POST',headers:{...headers,origin:'https://foreign.test'},body:JSON.stringify({code:s.codes[0]})})).status,403);
 const ok=await fetch(base+'/api/access/invite/verify',{method:'POST',headers,body:JSON.stringify({code:s.codes[0]})});assert.equal(ok.status,200);const grant=ok.headers.get('set-cookie')!;assert.match(grant,/HttpOnly/);assert.match(grant,/SameSite=Strict/);assert.ok(!grant.includes(s.codes[0]));headers.cookie+='; '+grant.split(';')[0];
 assert.equal((await (await fetch(base+'/api/access/session',{headers})).json()).authorized,true);assert.equal((await fetch(base+'/api/session',{headers})).status,200);
 assert.equal((await fetch(base+'/api/auth/login',{method:'POST',headers,body:'{}'})).status,404);assert.equal((await fetch(base+'/invites.json')).status,404);
 }finally{await new Promise<void>(r=>server.close(()=>r()));}
});
