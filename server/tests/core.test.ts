import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { Store } from '../store.js';
import { Jobs } from '../jobs.js';
import { fixture, compose, mask, normalize } from '../images.js';
import { createApp } from '../app.js';
import { refineJob } from '../../shared/contracts.js';

async function setup(ttl=60_000,latency=1) {const directory=await mkdtemp(join(tmpdir(),'shiye-test-'));const store=new Store(directory);await store.init();return {store,jobs:new Jobs(store,ttl,latency)};}
const owner='test-owner';
async function request(jobs:Jobs) {const s=await jobs.upload(owner,randomUUID());return {session:s,input:{operationId:randomUUID(),imageSessionId:s.imageSessionId,sourceRevision:s.sourceRevision,objectKey:s.objectKey}};}

test('three synthetic shapes produce two independently selectable initial candidates, metadata has no image bytes',async()=>{
  const {jobs,store}=await setup(),{input}=await request(jobs),j=await jobs.submit(owner,input,'auto');await jobs.idle();
  const done=jobs.get(owner,j.jobId);assert.equal(done.status,'succeeded');assert.equal(done.candidates?.length,2);
  assert.notEqual(done.candidates![0].candidateId,done.candidates![1].candidateId);
  const text=await readFile(join(store.directory,'state.json'),'utf8');assert.ok(!text.includes('data:image'));assert.ok(!text.includes('base64'));
});
test('a repeated operation reuses the job; conflicting content cannot reuse its ID',async()=>{
  const {jobs,store}=await setup(),{input}=await request(jobs);const a=await jobs.submit(owner,input,'auto'),b=await jobs.submit(owner,input,'auto');
  assert.equal(a.jobId,b.jobId);assert.equal(store.data.jobs.length,1);
  await assert.rejects(jobs.submit(owner,{...input,sourceRevision:2},'auto'),/不同内容/);await jobs.idle();
});
test('refine preserves successful candidates and rejects stale versions',async()=>{
  const {jobs}=await setup(),{input}=await request(jobs);const a=await jobs.submit(owner,input,'auto');await jobs.idle();const before=jobs.get(owner,a.jobId).candidates!;
  const r=await jobs.submit(owner,{...input,operationId:randomUUID(),promptRevision:1,positivePoints:[{x:.8,y:.73}]},'refine');await jobs.idle();
  const s=jobs.session(owner,input.imageSessionId);assert.equal(s.candidates.length,3);assert.deepEqual(s.candidates.slice(0,2),before);
  assert.equal(jobs.get(owner,r.jobId).candidates![0].name,'模拟形状 3');
  await assert.rejects(jobs.submit(owner,{...input,operationId:randomUUID(),promptRevision:1,positivePoints:[{x:.2,y:.4}]},'refine'),/修正已经更新/);
  await assert.rejects(jobs.submit(owner,{...input,operationId:randomUUID(),promptRevision:2,targetCandidateId:before[0].candidateId,candidateRevision:0,positivePoints:[{x:.2,y:.4}]},'refine'),/候选已经更新/);
});
test('cancelled job never commits late candidates',async()=>{
  const {jobs}=await setup(60_000,80),{input}=await request(jobs),job=await jobs.submit(owner,input,'auto');
  await jobs.cancel(owner,job.jobId);await jobs.idle();assert.equal(jobs.get(owner,job.jobId).status,'cancelled');assert.equal(jobs.session(owner,input.imageSessionId).candidates.length,0);
});
test('synthetic-only running jobs recover after restart without a second job record',async()=>{
  const {store,jobs}=await setup(),{input}=await request(jobs);const job=await jobs.submit(owner,input,'auto');await jobs.idle();
  await store.transaction(d=>{const j=d.jobs[0];j.status='running';delete j.candidates;});
  const restored=new Store(store.directory);await restored.init();const worker=new Jobs(restored,60_000,1);await worker.recover();await worker.idle();
  assert.equal(worker.get(owner,job.jobId).status,'succeeded');assert.equal(restored.data.jobs.length,1);
});
test('expired synthetic files become inaccessible and cleanup touches only managed media',async()=>{
  const {jobs,store}=await setup(),{session}=await request(jobs);const sentinel=join(store.directory,'keep.txt');await writeFile(sentinel,'keep');
  await store.transaction(d=>{d.sessions[0].expiresAt=0;d.media[0].expiresAt=0;});await jobs.expire();
  assert.throws(()=>jobs.session(owner,session.imageSessionId),/过期/);await assert.rejects(readFile(store.mediaPath(session.objectKey)));assert.equal(await readFile(sentinel,'utf8'),'keep');
});
test('failed atomic transaction leaves both memory and disk unchanged',async()=>{
  const {store,jobs}=await setup();await request(jobs);const before=structuredClone(store.data),disk=await readFile(join(store.directory,'state.json'),'utf8');
  await assert.rejects(store.transaction(d=>{d.sessions=[];throw Error('injected');}));assert.deepEqual(store.data,before);assert.equal(await readFile(join(store.directory,'state.json'),'utf8'),disk);
});
test('malformed store fails closed instead of resetting state',async()=>{
  const {store}=await setup();await writeFile(join(store.directory,'state.json'),'{ broken');await assert.rejects(new Store(store.directory).init(),/已保留文件/);assert.equal(await readFile(join(store.directory,'state.json'),'utf8'),'{ broken');
});
test('mask composition preserves original RGB and real alpha and rejects empty/misaligned masks',async()=>{
  const source=await fixture(),output=await compose(source,await mask(0));const data=await sharp(output.png).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.ok(data.data.some((_,i)=>i%4===3&&data.data[i]===0));assert.ok(data.data.some((_,i)=>i%4===3&&data.data[i]===255));
  const full=await sharp(source).ensureAlpha().raw().toBuffer();const x=155-output.box.x,y=175-output.box.y,offset=(y*data.info.width+x)*4;
  assert.deepEqual(data.data.subarray(offset,offset+3),full.subarray((175*600+155)*4,(175*600+155)*4+3));
  const empty=await sharp({create:{width:600,height:400,channels:3,background:'black'}}).png().toBuffer();await assert.rejects(compose(source,empty),/没有可用主体/);
  const small=await sharp(empty).resize(30,20).png().toBuffer();await assert.rejects(compose(source,small),/尺寸/);
});
test('invalid coordinates, missing foreground and unsupported prompt fields fail validation',()=>{
  const input={operationId:randomUUID(),imageSessionId:randomUUID(),objectKey:randomUUID(),sourceRevision:1,promptRevision:1};
  assert.equal(refineJob.safeParse({...input,positivePoints:[{x:2,y:.5}]}).success,false);
  assert.equal(refineJob.safeParse({...input,negativePoints:[{x:.1,y:.1}]}).success,false);
  assert.equal(refineJob.safeParse({...input,positivePoints:[{x:.1,y:.1}],url:'http://127.0.0.1'}).success,false);
});
test('actual image decoder rejects disguised or malformed input',async()=>{
  await assert.rejects(normalize(Buffer.from('<script>not a photo</script>')));
  const normalized=await normalize(await fixture());assert.equal((await sharp(normalized).metadata()).format,'png');
});
test('HTTP limits origins, session ownership, personal uploads and static files',async t=>{
  const runtime=join(await mkdtemp(join(tmpdir(),'shiye-http-test-')),'.private-media');
  const {app,jobs}=await createApp({runtime,staticRoot:resolve('shiye-editorial-prototype'),latency:1});
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
  t.after(()=>new Promise<void>(r=>server.close(()=>r())));
  const address=server.address() as {port:number},base=`http://127.0.0.1:${address.port}`;
  const session=await fetch(base+'/api/session'),cookie=session.headers.get('set-cookie')!.split(';')[0];
  const post=(path:string,body:unknown,extra={})=>fetch(base+path,{method:'POST',headers:{Origin:base,Cookie:cookie,'Content-Type':'application/json',...extra},body:JSON.stringify(body)});
  assert.equal((await fetch(base+'/')).status,200);
  for(const path of ['/.env.local','/README.md','/checkpoint-before-desk-20260907.tar.gz','/../PROJECT.md'])assert.equal((await fetch(base+path)).status,404);
  assert.equal((await post('/api/uploads/photo/init',{operationId:randomUUID(),fixture:true},{Origin:'https://example.com'})).status,403);
  const upload=await post('/api/uploads/photo/init',{operationId:randomUUID(),fixture:true});assert.equal(upload.status,201);const s=await upload.json() as {imageSessionId:string;objectKey:string;sourceRevision:number};
  const media=await fetch(base+'/api/media/'+s.objectKey,{headers:{Cookie:cookie}});assert.equal(media.status,200);assert.equal((await sharp(Buffer.from(await media.arrayBuffer())).metadata()).width,600);
  assert.equal((await fetch(base+'/api/media/'+s.objectKey)).status,401);
  const other=await fetch(base+'/api/session'),otherCookie=other.headers.get('set-cookie')!.split(';')[0];
  assert.equal((await fetch(base+'/api/media/'+s.objectKey,{headers:{Cookie:otherCookie}})).status,404);
  assert.equal((await fetch(base+'/api/uploads/photo/'+s.objectKey,{method:'PUT',headers:{Origin:base,Cookie:cookie},body:'photo'})).status,403);
  const response=await post('/api/segmentation/jobs',{operationId:randomUUID(),imageSessionId:s.imageSessionId,objectKey:s.objectKey,sourceRevision:s.sourceRevision});assert.equal(response.status,202);await jobs.idle();
  const job=await response.json() as {jobId:string};const result=await fetch(base+'/api/jobs/'+job.jobId,{headers:{Cookie:cookie}});assert.equal((await result.json() as {status:string}).status,'succeeded');
});
test('live mode cannot silently fall back to simulated output',async()=>{
  const runtime=await mkdtemp(join(tmpdir(),'shiye-live-blocked-'));await assert.rejects(createApp({runtime,staticRoot:resolve('shiye-editorial-prototype'),mode:'live'}),/不启用 live/);
});
