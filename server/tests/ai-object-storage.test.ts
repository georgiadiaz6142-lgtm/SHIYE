import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID,randomBytes,createCipheriv,createDecipheriv } from 'node:crypto';
import { ObjectDocumentGroup } from '../object-documents.js';
import { ObjectTemporaryMedia,type TemporaryObjects } from '../temporary-media.js';
import { AICopy } from '../ai-copy.js';
import { CopySettingsStore } from '../copy-settings.js';
import { CopyPromptStore } from '../copy-prompt.js';
import type { CopyProvider } from '../copy-provider.js';
import { copyInput } from '../../shared/ai-copy.js';
import { Fault,type StoreData } from '../../shared/contracts.js';
import { Store } from '../store.js';
import { Jobs } from '../jobs.js';
import { Naming } from '../naming.js';
import sharp from 'sharp';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import type { Server } from 'node:http';
import { createApp } from '../app.js';
import { Admin } from '../admin.js';
import { InviteAccess,generateInvites,configSchema } from '../access.js';

class Objects implements TemporaryObjects {
  rows=new Map<string,{bytes:Buffer;etag:string}>();
  afterPut?: (key:string,bytes:Buffer)=>void;
  failDelete=false;
  async get(key:string){const r=this.rows.get(key);return r?{bytes:Buffer.from(r.bytes),etag:r.etag}:null;}
  async put(key:string,bytes:Buffer,expected:string|null){
    if((this.rows.get(key)?.etag??null)!==expected)return false;
    this.rows.set(key,{bytes:Buffer.from(bytes),etag:randomUUID()});this.afterPut?.(key,bytes);return true;
  }
  async removeTemporary(key:string){if(this.failDelete)throw Error('synthetic cleanup failure');this.rows.delete(key);}
}
const fault=(type:string)=>(e:unknown)=>e instanceof Fault&&e.errorType===type;
const input=()=>copyInput.parse({operationId:randomUUID(),bookId:'book',pageId:'page',sourceRevision:'a'.repeat(64),mode:'generate',topic:'合成测试素材'});
const result={text:'窗边的一段安静时光。',provider:'test' as const,model:'fixture',usage:{inputTokens:20,outputTokens:12}};
const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return {promise,resolve};};
function encryption(){
  const key=randomBytes(32);
  return {
    seal:(s:string)=>{const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key,iv),bytes=Buffer.concat([c.update(s),c.final()]);return Buffer.concat([iv,c.getAuthTag(),bytes]).toString('base64');},
    unseal:(s:string)=>{const b=Buffer.from(s,'base64'),d=createDecipheriv('aes-256-gcm',key,b.subarray(0,12));d.setAuthTag(b.subarray(12,28));return Buffer.concat([d.update(b.subarray(28)),d.final()]).toString();},
  };
}
function copyFixture(provider:CopyProvider){
  const objects=new Objects(),crypt=encryption();let now=Date.now();
  const instance=async()=>{
    const documents=new ObjectDocumentGroup(objects,'ai/state.json'),prompt=new CopyPromptStore('/unused/prompt',documents);
    const settings=new CopySettingsStore('/unused/settings',crypt.seal,crypt.unseal,()=>now,prompt,documents);
    const copy=new AICopy('/unused/copy',settings,crypt.seal,crypt.unseal,provider,()=>now,45000,documents);await copy.init();
    return {copy,settings,prompt,documents};
  };
  return {objects,instance,now:()=>now,advance:(ms:number)=>{now+=ms;}};
}

test('AI configuration and prompts persist encrypted across instances and concurrent stale edits are rejected',async()=>{
  const f=copyFixture({generate:async()=>result}),a=await f.instance(),b=await f.instance();
  const config={revision:0,providerId:'qwen',apiKey:'synthetic-qwen-key',model:'fixture',enabled:true,maxCalls:8,approvedUntil:f.now()+60000,inputRate:1,outputRate:2};
  const saves=await Promise.allSettled([a.settings.save('admin',config),b.settings.save('admin',{...config,model:'other'})]);
  assert.equal(saves.filter(r=>r.status==='fulfilled').length,1);assert.equal((await b.settings.public()).revision,1);
  const edits=await Promise.allSettled([a.prompt.save('admin',{revision:0,text:'提示词甲'}),b.prompt.save('admin',{revision:0,text:'提示词乙'})]);
  assert.equal(edits.filter(r=>r.status==='fulfilled').length,1);
  const c=await f.instance();assert.equal((await c.prompt.read()).revision,1);assert.equal((await c.settings.public()).configured,true);
  assert.ok(!f.objects.rows.get('ai/state.json')!.bytes.toString().includes(config.apiKey));
});

test('two AI instances reserve once, a third startup preserves the running task, and success consumes quota once',async()=>{
  const gate=deferred(),started=deferred();let calls=0;
  const f=copyFixture({generate:async()=>{calls++;started.resolve();await gate.promise;return result;}}),a=await f.instance(),b=await f.instance(),who={owner:'invite:'+randomUUID()},value=input();
  try{
    await Promise.all([a.copy.submit(async()=>who,value),b.copy.submit(async()=>who,value)]);await started.promise;
    const c=await f.instance();assert.equal((await c.copy.get(who,value.operationId)).status,'pending');assert.equal(calls,1);
    gate.resolve();await Promise.all([a.copy.idle(),b.copy.idle()]);
    assert.equal((await c.copy.get(who,value.operationId)).text,result.text);assert.equal((await c.copy.status(who)).used,1);
    await c.copy.submit(async()=>who,value);assert.equal(calls,1);
    const raw=f.objects.rows.get('ai/state.json')!.bytes.toString();assert.ok(!raw.includes(result.text));assert.ok(!raw.includes(value.topic));
    await assert.rejects(c.copy.get({owner:'account:'+randomUUID()},value.operationId),fault('COPY_NOT_FOUND'));
  }finally{gate.resolve();await Promise.all([a.copy.idle(),b.copy.idle()]);}
});

test('shared AI quota cannot be oversubscribed by simultaneous distinct requests',async()=>{
  const gate=deferred();let calls=0;const f=copyFixture({generate:async()=>{calls++;await gate.promise;return result;}}),a=await f.instance(),b=await f.instance(),who={owner:'invite:'+randomUUID()};
  try{
    const attempts=await Promise.allSettled(Array.from({length:5},(_,i)=>(i%2?a:b).copy.submit(async()=>who,input())));
    assert.equal(attempts.filter(x=>x.status==='fulfilled').length,3);assert.equal((await a.copy.status(who)).remaining,0);
  }finally{gate.resolve();await Promise.all([a.copy.idle(),b.copy.idle()]);}
  assert.equal(calls,3);assert.equal((await b.copy.status(who)).used,3);
});

test('shared cumulative AI service cap includes simultaneous reservations from different accounts',async()=>{
  const gate=deferred();let calls=0;const f=copyFixture({generate:async()=>{calls++;await gate.promise;return result;}}),a=await f.instance(),b=await f.instance();
  await a.settings.save('admin',{revision:0,apiKey:'',model:'',enabled:false,maxCalls:1,approvedUntil:null,inputRate:null,outputRate:null});
  try{
    const who1={owner:'account:'+randomUUID()},who2={owner:'account:'+randomUUID()};
    const stable=await Promise.allSettled([a.copy.submit(async()=>who1,input()),b.copy.submit(async()=>who2,input())]);
    assert.equal(stable.filter(r=>r.status==='fulfilled').length,1);assert.equal((stable.find(r=>r.status==='rejected') as PromiseRejectedResult).reason.errorType,'COPY_SERVICE_LIMIT');
  }finally{gate.resolve();await Promise.all([a.copy.idle(),b.copy.idle()]);}
  assert.equal(calls,1);
});

test('unknown result-write response retries persistence without another AI call or overwriting success',async()=>{
  let calls=0,lost=false;const f=copyFixture({generate:async()=>{calls++;return result;}}),a=await f.instance(),who={owner:'account:'+randomUUID()},value=input();
  f.objects.afterPut=(key,bytes)=>{if(!lost&&key==='ai/state.json'&&bytes.toString().includes('"status":"succeeded"')){lost=true;throw new Fault(503,'STORAGE_WRITE_UNCONFIRMED','synthetic lost reply');}};
  await a.copy.submit(async()=>who,value);await a.copy.idle();const b=await f.instance();
  assert.equal(lost,true);assert.equal(calls,1);assert.equal((await b.copy.get(who,value.operationId)).status,'succeeded');assert.equal((await b.copy.status(who)).used,1);
});

test('unknown dispatch acknowledgement never triggers AI; expired leases are not replayed and reject late results',async()=>{
  let calls=0,lost=false;const f=copyFixture({generate:async()=>{calls++;return result;}}),a=await f.instance(),who={owner:'account:'+randomUUID()},value=input();
  f.objects.afterPut=(key,bytes)=>{if(!lost&&key==='ai/state.json'&&bytes.toString().includes('"dispatchId"')){lost=true;throw new Fault(503,'STORAGE_WRITE_UNCONFIRMED','synthetic lost claim');}};
  await a.copy.submit(async()=>who,value);await a.copy.idle();assert.equal(calls,0);assert.equal((await a.copy.get(who,value.operationId)).charged,false);
  const gate=deferred(),started=deferred();const g=copyFixture({generate:async()=>{calls++;started.resolve();await gate.promise;return result;}}),c=await g.instance(),value2=input();
  try{
    await c.copy.submit(async()=>who,value2);await started.promise;g.advance(120000);
    const d=await g.instance();assert.equal((await d.copy.get(who,value2.operationId)).error?.errorType,'COPY_INTERRUPTED');assert.equal((await d.copy.status(who)).pending,0);
    await d.copy.submit(async()=>who,value2);assert.equal(calls,1);gate.resolve();await c.copy.idle();assert.equal((await d.copy.get(who,value2.operationId)).status,'failed');
  }finally{gate.resolve();await c.copy.idle();}
});

async function taskFixture(provider?:{segment(source:Buffer):Promise<{mask:Buffer;requestId:string}>}){
  const objects=new Objects();
  const instance=async()=>{
    const store=new Store('/unused/task-files',{documents:new ObjectDocumentGroup(objects,'tasks/state.json'),media:new ObjectTemporaryMedia(objects)});await store.init();
    const jobs=new Jobs(store,3600000,1,provider?{provider,maxCalls:10,approvedUntil:Date.now()+3600000}:undefined);await jobs.recover();return {store,jobs};
  };return {objects,instance};
}
const start=(s:{imageSessionId:string;objectKey:string;sourceRevision:number})=>({operationId:randomUUID(),imageSessionId:s.imageSessionId,objectKey:s.objectKey,sourceRevision:s.sourceRevision});
const photo=()=>sharp({create:{width:128,height:128,channels:3,background:'#887766'}}).png().toBuffer();
const mask=()=>sharp({create:{width:128,height:128,channels:3,background:'white'}}).greyscale().png().toBuffer();

test('Baidu task claim is shared, startup does not interrupt live work, and output media can be read by another instance',async()=>{
  const gate=deferred(),started=deferred();let calls=0;
  const f=await taskFixture({segment:async()=>{calls++;started.resolve();await gate.promise;return {mask:await mask(),requestId:'123456'};}}),a=await f.instance(),b=await f.instance(),owner='account:'+randomUUID();
  try{
    const s=await a.jobs.uploadPhoto(owner,randomUUID(),await photo()),value=start(s);
    const [x,y]=await Promise.all([a.jobs.submit(owner,value,'auto'),b.jobs.submit(owner,value,'auto')]);assert.equal(x.jobId,y.jobId);await started.promise;
    const c=await f.instance();assert.equal((await c.jobs.readJob(owner,x.jobId)).status,'running');assert.equal(calls,1);
    gate.resolve();await Promise.all([a.jobs.idle(),b.jobs.idle()]);const saved=await c.jobs.readJob(owner,x.jobId);assert.equal(saved.status,'succeeded');
    assert.ok((await sharp(await c.store.getMedia(saved.candidates![0].transparentRef)).metadata()).hasAlpha);
    await assert.rejects(c.jobs.readJob('other-account',x.jobId),fault('NOT_FOUND'));
    await c.jobs.submit(owner,value,'auto');await c.jobs.idle();assert.equal(calls,1);
  }finally{gate.resolve();await Promise.all([a.jobs.idle(),b.jobs.idle()]);}
});

test('Baidu cancellation or expired execution lease wins over a late response without resubmission',async()=>{
  const gate=deferred(),started=deferred();let calls=0;
  const f=await taskFixture({segment:async()=>{calls++;started.resolve();await gate.promise;return {mask:await mask(),requestId:'123'};}}),a=await f.instance(),owner='account:'+randomUUID();
  try{
    const s=await a.jobs.uploadPhoto(owner,randomUUID(),await photo()),job=await a.jobs.submit(owner,start(s),'auto');await started.promise;
    const b=await f.instance();await b.jobs.cancel(owner,job.jobId);gate.resolve();await a.jobs.idle();assert.equal((await b.jobs.readJob(owner,job.jobId)).status,'cancelled');assert.equal(calls,1);
    const raw=JSON.parse(f.objects.rows.get('tasks/state.json')!.bytes.toString());const row=raw.values.segmentation.jobs[0];row.status='running';row.leaseUntil=Date.now()-1;
    f.objects.rows.set('tasks/state.json',{bytes:Buffer.from(JSON.stringify(raw)),etag:randomUUID()});
    const c=await f.instance();assert.equal((await c.jobs.readJob(owner,job.jobId)).error?.errorType,'RECOVERY_REQUIRES_REVIEW');await c.jobs.idle();assert.equal(calls,1);
  }finally{gate.resolve();await a.jobs.idle();}
});

test('Baidu result acknowledgement loss only retries persistence and does not append duplicate candidates',async()=>{
  let calls=0,lost=false;const f=await taskFixture({segment:async()=>{calls++;return {mask:await mask(),requestId:'123'};}}),a=await f.instance(),owner='owner';
  f.objects.afterPut=(key,bytes)=>{if(!lost&&key==='tasks/state.json'&&bytes.toString().includes('"status":"succeeded"')){lost=true;throw new Fault(503,'STORAGE_WRITE_UNCONFIRMED','synthetic lost response');}};
  const s=await a.jobs.uploadPhoto(owner,randomUUID(),await photo()),job=await a.jobs.submit(owner,start(s),'auto');await a.jobs.idle();const b=await f.instance();
  const saved=await b.jobs.readJob(owner,job.jobId);assert.equal(saved.status,'succeeded');assert.equal(saved.candidates!.length,1);assert.equal(calls,1);assert.equal(lost,true);
  assert.equal((await b.store.read()).media.length,3);
});

test('temporary media deletion failures keep a retry record; cleanup never removes other objects',async()=>{
  const f=await taskFixture(),a=await f.instance(),owner='synthetic-owner';const s=await a.jobs.upload(owner,randomUUID());
  const sentinel='works/sentinel.bin';f.objects.rows.set(sentinel,{bytes:Buffer.from('keep'),etag:'v1'});
  await a.store.transaction(d=>{d.media[0].expiresAt=Date.now()-1;d.sessions[0].expiresAt=Date.now()-1;});f.objects.failDelete=true;
  await assert.rejects(a.jobs.expire());assert.equal((await a.store.read()).media.length,1);
  f.objects.failDelete=false;await a.jobs.expire();assert.equal((await a.store.read()).media.length,0);assert.ok(!f.objects.rows.has(`temporary/${s.objectKey}.bin`));assert.ok(f.objects.rows.has(sentinel));
});

test('shared naming attempts are not replayed and unknown success responses do not destroy cached names',async()=>{
  const f=await taskFixture(),a=await f.instance(),owner='owner',s=await a.jobs.upload(owner,randomUUID()),job=await a.jobs.submit(owner,start(s),'auto');await a.jobs.idle();
  const candidate=(await a.jobs.readJob(owner,job.jobId)).candidates![0],b=await f.instance();let calls=0,lost=false;
  const provider={name:async()=>{calls++;return {name:'合成贴纸',requestId:'123'};}};
  const live={provider:{segment:async()=>({mask:await mask(),requestId:'1'})},maxCalls:10,approvedUntil:Date.now()+60000};
  const ja=new Jobs(a.store,3600000,1,live),jb=new Jobs(b.store,3600000,1,live);
  f.objects.afterPut=(key,bytes)=>{if(!lost&&key==='tasks/state.json'&&bytes.toString().includes('"name":"合成贴纸"')){lost=true;throw new Fault(503,'STORAGE_WRITE_UNCONFIRMED','lost naming reply');}};
  const args=[owner,s.imageSessionId,candidate.candidateId,candidate.candidateRevision,await photo()] as const;
  await Promise.all([new Naming(ja,provider).suggest(...args),new Naming(jb,provider).suggest(...args)]);
  assert.equal(calls,1);assert.equal(lost,true);assert.equal(await new Naming(jb,provider).suggest(...args),'合成贴纸');
});

test('two HTTP applications share AI prompts, results, task sessions and private media through injected storage',async()=>{
  const objects=new Objects(),encryptionKey=randomBytes(32),initial={username:'宋静雯',password:'synthetic-password-123'},servers:Server[]=[];
  const applications:Awaited<ReturnType<typeof createApp>>[]=[],bases:string[]=[];
  await new ObjectDocumentGroup(objects,'identity.json').cell('invites',v=>configSchema.parse(v)).initialize(generateInvites(1).config);
  try{
    for(let i=0;i<2;i++){
      const documents=new ObjectDocumentGroup(objects,'identity.json'),access=new InviteAccess('/unused/access',undefined,documents),admin=new Admin('/unused/admin',access,undefined,{documents,encryptionKey});
      await admin.init({apiKey:'',secretKey:'',cutout:false,naming:false},initial);
      const application=await createApp({runtime:await mkdtemp(join(tmpdir(),'shiye-ai-object-http-')),staticRoot:resolve('shiye-editorial-prototype'),latency:1,access,admin,aiDocuments:new ObjectDocumentGroup(objects,'ai.json'),taskStorage:{documents:new ObjectDocumentGroup(objects,'tasks.json'),media:new ObjectTemporaryMedia(objects)},copyProvider:{generate:async()=>result}});
      applications.push(application);const server=application.app.listen(0,'127.0.0.1');servers.push(server);await new Promise<void>((r,j)=>{server.once('listening',r);server.once('error',j);});bases.push(`http://127.0.0.1:${(server.address() as {port:number}).port}`);
    }
    const session=await fetch(bases[0]+'/api/access/session');let cookie=session.headers.getSetCookie()[0].split(';')[0];let owner='';
    const request=(i:number,path:string,value?:unknown)=>fetch(bases[i]+path,{method:value===undefined?'GET':'POST',headers:{cookie,origin:bases[i],'content-type':'application/json','x-shiye-copy-owner':owner},...(value===undefined?{}:{body:JSON.stringify(value)})});
    const login=await request(0,'/api/access/login',initial);assert.equal(login.status,200);owner='account:'+(await login.json()).account.id;cookie+='; '+login.headers.getSetCookie().find(v=>v.startsWith('shiye_admin='))!.split(';')[0];
    assert.equal((await request(0,'/api/admin/copy/prompt',{revision:0,text:'跨服务共用提示词'})).status,200);assert.equal((await (await request(1,'/api/admin/copy/prompt')).json()).text,'跨服务共用提示词');
    const value=input();assert.equal((await request(0,'/api/ai/copy',value)).status,202);await applications[0].copy!.idle();assert.equal((await (await request(1,'/api/ai/copy/'+value.operationId)).json()).text,result.text);
    const uploaded=await request(0,'/api/uploads/photo/init',{operationId:randomUUID(),fixture:true});assert.equal(uploaded.status,201);const photoSession=await uploaded.json();
    const submitted=await request(0,'/api/segmentation/jobs',start(photoSession));assert.equal(submitted.status,202);const job=await submitted.json();await applications[0].jobs.idle();
    const saved=await(await request(1,'/api/jobs/'+job.jobId)).json();assert.equal(saved.status,'succeeded');assert.equal(saved.executionId,undefined);assert.equal((await(await request(1,'/api/session')).json()).session.imageSessionId,photoSession.imageSessionId);
    const media=await request(1,'/api/media/'+saved.candidates[0].transparentRef);assert.equal(media.status,200);assert.ok((await media.arrayBuffer()).byteLength>0);
    assert.equal((await request(1,'/api/account/logout',{})).status,200);assert.equal((await request(0,'/api/media/'+saved.candidates[0].transparentRef)).status,401);
  }finally{await Promise.all(applications.map(async a=>{await a.copy?.idle();await a.jobs.idle();}));await Promise.all(servers.map(s=>new Promise<void>(r=>{s.close(()=>r());s.closeAllConnections();})));}
});
