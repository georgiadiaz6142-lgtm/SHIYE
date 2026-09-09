import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { randomUUID,createHash } from 'node:crypto';
import sharp from 'sharp';
import { createApp } from '../app.js';
import { BaiduProvider } from '../baidu.js';
import { fixture,mask } from '../images.js';
import { Naming } from '../naming.js';

test('Baidu naming uses recognition endpoint, selects confident label and does not retry',async()=>{
  let calls=0;
  const provider=new BaiduProvider('test-key','test-secret',(async(url:unknown,init:RequestInit)=>{
    calls++;if(String(url).endsWith('/token'))return new Response(JSON.stringify({access_token:'test-token',expires_in:3600}));
    assert.ok(String(url).includes('/image-classify/v2/advanced_general?'));
    assert.ok(init.body instanceof URLSearchParams);assert.ok(init.body.get('image'));
    return new Response(JSON.stringify({log_id:'12345',result:[{keyword:'风景',score:.2},{keyword:'白花',score:.92},{keyword:'<script>',score:.99}]}));
  }) as typeof fetch);
  assert.deepEqual(await provider.name(await fixture()),{name:'白花',requestId:'12345'});assert.equal(calls,2);
});

test('final thumbnail naming: owner/version checks, dedupe, persistent accounting, failures and expiry',async t=>{
  const runtime=await mkdtemp(join(tmpdir(),'shiye-naming-'));let calls=0,fail=false;
  const options={runtime,staticRoot:resolve('shiye-editorial-prototype'),mode:'live',ttl:60000,live:{maxCalls:null,approvedUntil:null,provider:{segment:async()=>({mask:await mask(0),requestId:'1'})}},naming:{name:async(image:Buffer)=>{
    calls++;assert.equal((await sharp(image).metadata()).width,640);
    const rgb=await sharp(image).resize(1,1).raw().toBuffer();assert.ok(rgb[0]>rgb[1]*2,'receives supplied final red thumbnail, not original fixture');
    if(fail)throw Error('provider unavailable');return {name:'红色贴纸',requestId:'2'};
  }}};
  const service=await createApp(options),server=service.app.listen(0,'127.0.0.1');t.after(()=>server.close());await new Promise<void>(r=>server.once('listening',r));const base='http://127.0.0.1:'+(server.address() as {port:number}).port;
  const sessionResponse=await fetch(base+'/api/session'),cookie=sessionResponse.headers.get('set-cookie')!.split(';')[0],owner=createHash('sha256').update(cookie.split('=')[1]).digest('hex');
  const s=await service.jobs.uploadPhoto(owner,randomUUID(),await fixture());const job=await service.jobs.submit(owner,{operationId:randomUUID(),imageSessionId:s.imageSessionId,objectKey:s.objectKey,sourceRevision:1},'auto');await service.jobs.idle();const c=service.jobs.get(owner,job.jobId).candidates![0];
  const image=await sharp({create:{width:640,height:640,channels:3,background:'red'}}).jpeg().toBuffer(),url=base+`/api/stickers/name/${s.imageSessionId}/${c.candidateId}/${c.candidateRevision}`;
  const post=(target=url,headers={Cookie:cookie,Origin:base,'Content-Type':'image/jpeg'},body=image)=>fetch(target,{method:'POST',headers,body:new Uint8Array(body)});
  assert.equal((await post(url,{Cookie:cookie,Origin:'http://example.invalid','Content-Type':'image/jpeg'})).status,403);assert.equal(calls,0);
  const stranger=(await fetch(base+'/api/session')).headers.get('set-cookie')!.split(';')[0];assert.equal((await post(url,{Cookie:stranger,Origin:base,'Content-Type':'image/jpeg'})).status,404);
  assert.equal((await post(url.replace(/\d+$/,'999'))).status,409);assert.equal(calls,0);
  const responses=await Promise.all([post(),post()]);for(const r of responses)assert.deepEqual(await r.json(),{name:'红色贴纸'});assert.equal(calls,1);
  const restored=await createApp(options);assert.equal(restored.store.data.naming?.length,1);assert.equal(restored.store.data.naming?.[0].status,'succeeded');
  assert.equal(await new Naming(restored.jobs,options.naming).suggest(owner,s.imageSessionId,c.candidateId,c.candidateRevision,image),'红色贴纸');assert.equal(calls,1);
  fail=true;const changed=await sharp(image).modulate({brightness:.9}).jpeg().toBuffer();assert.deepEqual(await (await post(url,undefined,changed)).json(),{name:'照片贴纸'});await post(url,undefined,changed);assert.equal(calls,2);assert.equal(service.store.data.naming?.length,2);
  await service.store.transaction(d=>{d.sessions[0].expiresAt=Date.now()-1;for(const n of d.naming||[])n.expiresAt=Date.now()-1;});await service.jobs.expire();assert.equal((await post()).status,410);assert.ok(service.store.data.naming?.every(n=>!n.name));assert.equal(calls,2);
});
