import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { BaiduProvider, pixelBox } from '../baidu.js';
import { fixture, mask, normalizeBaidu } from '../images.js';
import { Jobs } from '../jobs.js';
import { Store } from '../store.js';
import { createApp } from '../app.js';
import { Fault, refineJob } from '../../shared/contracts.js';

// All credentials and upstream responses in this file are invented test data.
const credentials=['test-api-key','test-secret-key'];
const json=(value:unknown)=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});
const auth=()=>json({access_token:'test-token',expires_in:3600});
const successful=async()=>json({image:(await sharp(await mask(0)).greyscale().png().toBuffer()).toString('base64'),log_id:'18446744073709551615'});
function fakeTransport(handler:(url:string,init:RequestInit)=>Promise<Response>):typeof fetch {
  return (async(url:unknown,init:RequestInit)=>handler(String(url),init)) as typeof fetch;
}
const owner='test-owner';
const input=(s:{imageSessionId:string;objectKey:string;sourceRevision:number})=>({operationId:randomUUID(),imageSessionId:s.imageSessionId,objectKey:s.objectKey,sourceRevision:s.sourceRevision});
async function setup(maxCalls=10,segment?:()=>Promise<{mask:Buffer;requestId:string}>) {
  const store=new Store(await mkdtemp(join(tmpdir(),'shiye-baidu-unit-')));await store.init();
  let calls=0;
  const provider={segment:async()=>{calls++;return segment?segment():{mask:await mask(0),requestId:'12345'};}};
  const jobs=new Jobs(store,60000,0,{provider,maxCalls,approvedUntil:Date.now()+60000});
  return {store,jobs,calls:()=>calls};
}

test('Baidu adapter sends JSON auto/control masks, caches token, preserves uint64 request ID',async()=>{
  let authCalls=0;const bodies:Record<string,unknown>[]=[];
  const provider=new BaiduProvider(...credentials as [string,string],fakeTransport(async(url,init)=>{
    assert.equal(init.redirect,'error');
    if(url.endsWith('/oauth/2.0/token')){authCalls++;const body=init.body as URLSearchParams;assert.equal(body.get('client_id'),credentials[0]);assert.equal(body.get('client_secret'),credentials[1]);return auth();}
    assert.ok(url.startsWith('https://aip.baidubce.com/rest/2.0/image-process/v1/segment?'));assert.equal((init.headers as Record<string,string>)['Content-Type'],'application/json');
    bodies.push(JSON.parse(init.body as string));
    const response=await successful();return new Response((await response.text()).replace('"18446744073709551615"','18446744073709551615'));
  }));
  const source=await fixture(),result=await provider.segment(source);await provider.segment(source,{x:.1,y:.2,width:.4,height:.5});
  assert.equal(authCalls,1);assert.equal(result.requestId,'18446744073709551615');assert.equal(bodies[0].image,source.toString('base64'));assert.equal(bodies[0].return_form,'mask');assert.equal(bodies[0].refine_mask,'true');assert.equal(bodies[0].method,'auto');assert.equal(bodies[0].position,undefined);
  assert.equal(bodies[1].method,'control');assert.deepEqual(bodies[1].position,[[[60,80],[300,280]]]);
});

test('Baidu invalid credentials, provider errors and network errors never echo upstream secrets or retry',async()=>{
  for(const scenario of ['auth','upstream','network']){
    let calls=0;
    const p=new BaiduProvider(...credentials as [string,string],fakeTransport(async url=>{
      calls++;
      if(scenario==='network')throw new Error('test-secret-key test-token');
      if(url.endsWith('/token'))return scenario==='auth'?json({error:'test-secret-key'}):auth();
      return json({error_code:110,error_msg:'test-token test-secret-key'});
    }));
    await assert.rejects(p.segment(await fixture()),(e:unknown)=>{assert.ok(e instanceof Fault);assert.ok(!JSON.stringify(e).includes('test-secret-key'));assert.ok(!e.message.includes('test-token'));return true;});
    assert.equal(calls,scenario==='upstream'?2:1);
  }
});

test('Baidu invalid base64, wrong dimensions, colored masks and oversized response fail closed',async()=>{
  const badMasks=['%%%=',(await sharp({create:{width:10,height:10,channels:3,background:'white'}}).png().toBuffer()).toString('base64'),(await fixture()).toString('base64')];
  for(const encoded of badMasks){
    const provider=new BaiduProvider(...credentials as [string,string],fakeTransport(async url=>url.endsWith('/token')?auth():json({image:encoded,log_id:'12'})));
    await assert.rejects(provider.segment(await fixture()),Fault);
  }
  const p=new BaiduProvider(...credentials as [string,string],fakeTransport(async url=>url.endsWith('/token')?auth():new Response('not read',{headers:{'Content-Length':'16000001'}})));
  await assert.rejects(p.segment(await fixture()),/超过限制/);
});

test('Baidu timeout fails without retry and image/box validation precedes credential transmission',async()=>{
  let calls=0;
  const p=new BaiduProvider(...credentials as [string,string],fakeTransport(async(_url,init)=>{
    calls++;return new Promise<Response>((_resolve,reject)=>{init.signal!.addEventListener('abort',()=>reject(Error('timeout')),{once:true});setTimeout(()=>reject(Error('timeout guard')),100);});
  }),10);
  await assert.rejects(p.segment(await fixture()),(e:unknown)=>e instanceof Fault&&e.errorType==='PROVIDER_TIMEOUT');assert.equal(calls,1);
  const small=await sharp({create:{width:64,height:64,channels:3,background:'white'}}).png().toBuffer();
  await assert.rejects(p.segment(small),/尺寸/);assert.equal(calls,1);
  assert.throws(()=>pixelBox({x:.1,y:.1,width:.001,height:.001},600,400),/10/);
  assert.deepEqual(pixelBox({x:0,y:0,width:1,height:1},600,400),[[[1,1],[599,399]]]);
  await assert.rejects(normalizeBaidu(small),/128/);
});

test('Baidu jobs keep real provenance, enforce box-only correction, preserve other candidates and cap attempts',async()=>{
  const {store,jobs,calls}=await setup(3);const uploadId=randomUUID(),source=await fixture(),s=await jobs.uploadPhoto(owner,uploadId,source);
  assert.equal((await jobs.uploadPhoto(owner,uploadId,source)).imageSessionId,s.imageSessionId);
  await assert.rejects(jobs.uploadPhoto(owner,uploadId,await mask(0)),/同一次上传/);
  const body=input(s),j=await jobs.submit(owner,body,'auto');await jobs.idle();await jobs.submit(owner,body,'auto');await jobs.idle();assert.equal(calls(),1);
  const first=jobs.get(owner,j.jobId);assert.equal(first.status,'succeeded');assert.equal(first.mock,false);assert.equal(first.cost.amount,null);assert.equal(first.candidates!.length,1);assert.equal(first.candidates![0].providerRequestId,'12345');
  const invalid=refineJob.parse({...input(s),promptRevision:1,positivePoints:[{x:.3,y:.3}]});await assert.rejects(jobs.submit(owner,invalid,'refine'),/仅支持框选/);assert.equal(calls(),1);
  const box={x:.1,y:.1,width:.5,height:.7};
  await jobs.submit(owner,refineJob.parse({...input(s),promptRevision:1,box}),'refine');await jobs.idle();assert.equal(jobs.session(owner,s.imageSessionId).candidates.length,2);
  const target=first.candidates![0],untouched=structuredClone(jobs.session(owner,s.imageSessionId).candidates[1]);
  await jobs.submit(owner,refineJob.parse({...input(s),promptRevision:2,box,targetCandidateId:target.candidateId,candidateRevision:target.candidateRevision}),'refine');await jobs.idle();assert.deepEqual(jobs.session(owner,s.imageSessionId).candidates.find(c=>c.candidateId===untouched.candidateId),untouched);
  const limit=await jobs.submit(owner,input(s),'auto');await jobs.idle();assert.equal(jobs.get(owner,limit.jobId).error?.errorType,'TEST_CALL_LIMIT');assert.equal(calls(),3);
  assert.equal(store.data.jobs.filter(j=>j.providerAttemptedAt!==undefined).length,3);
});

test('Baidu cancelled late response never commits; restart never resubmits live tasks',async()=>{
  let release!:()=>void,started!:()=>void;
  const waiting=new Promise<void>(r=>started=r),hold=new Promise<void>(r=>release=r);
  const {store,jobs,calls}=await setup(10,async()=>{started();await hold;return {mask:await mask(0),requestId:'42'};});
  const s=await jobs.uploadPhoto(owner,randomUUID(),await fixture()),j=await jobs.submit(owner,input(s),'auto');await waiting;await jobs.cancel(owner,j.jobId);release();await jobs.idle();
  assert.equal(jobs.get(owner,j.jobId).status,'cancelled');assert.equal(jobs.session(owner,s.imageSessionId).candidates.length,0);assert.equal(calls(),1);
  await store.transaction(d=>{d.jobs[0].status='running';});await jobs.recover();await jobs.idle();assert.equal(calls(),1);assert.equal(jobs.get(owner,j.jobId).error?.errorType,'RECOVERY_REQUIRES_REVIEW');
});

test('HTTP live photo gate, consent, ownership, result PNG, session recovery and default mock denial',async t=>{
  let calls=0;
  const provider=new BaiduProvider(...credentials as [string,string],fakeTransport(async url=>{calls++;return url.endsWith('/token')?auth():successful();}));
  const runtime=join(await mkdtemp(join(tmpdir(),'shiye-baidu-http-')),'.private');
  const {app,jobs}=await createApp({runtime,staticRoot:resolve('shiye-editorial-prototype'),mode:'live',ttl:60000,live:{provider,maxCalls:2,approvedUntil:Date.now()+60000}});
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));t.after(()=>new Promise<void>(r=>server.close(()=>r())));
  const base=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
  const health=await (await fetch(base+'/api/health')).json() as {liveAvailable:boolean};assert.equal(health.liveAvailable,true);assert.equal(calls,0);
  const response=await fetch(base+'/api/session'),cookie=response.headers.get('set-cookie')!.split(';')[0];
  const headers={Origin:base,Cookie:cookie,'Content-Type':'application/octet-stream','X-Shiye-Operation-Id':randomUUID()},source=await fixture();
  assert.equal((await fetch(base+'/api/uploads/photo',{method:'POST',headers,body:new Uint8Array(source)})).status,403);assert.equal(calls,0);
  const uploaded=await fetch(base+'/api/uploads/photo',{method:'POST',headers:{...headers,'X-Shiye-Baidu-Consent':'true'},body:new Uint8Array(source)});assert.equal(uploaded.status,201);
  const session=await uploaded.json() as {imageSessionId:string;objectKey:string;sourceRevision:number};assert.equal(calls,0);
  const job=await (await fetch(base+'/api/segmentation/jobs',{method:'POST',headers:{Origin:base,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(input(session))})).json() as {jobId:string};await jobs.idle();assert.equal(calls,2);
  const result=jobs.get((await import('node:crypto')).createHash('sha256').update(cookie.split('=')[1]).digest('hex'),job.jobId);assert.equal(result.status,'succeeded');
  const png=await fetch(base+'/api/media/'+result.candidates![0].transparentRef,{headers:{Cookie:cookie}});assert.equal(png.status,200);assert.equal((await sharp(Buffer.from(await png.arrayBuffer())).metadata()).hasAlpha,true);
  assert.equal((await fetch(base+'/api/media/'+session.objectKey)).status,401);assert.equal((await fetch(base+'/.env.local')).status,404);
  const restored=await (await fetch(base+'/api/session',{headers:{Cookie:cookie}})).json() as {session:{candidates:unknown[]}};assert.equal(restored.session.candidates.length,1);
  const disk=await readFile(join(runtime,'state.json'),'utf8');for(const secret of [...credentials,'test-token'])assert.ok(!disk.includes(secret));
  await assert.rejects(createApp({runtime:runtime+'-blocked',staticRoot:resolve('shiye-editorial-prototype'),mode:'live'}),/不启用 live/);
});
