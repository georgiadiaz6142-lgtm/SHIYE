import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID,createCipheriv,createDecipheriv} from 'node:crypto';
import type {Server} from 'node:http';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {ObjectDocumentGroup} from '../object-documents.js';
import {CloudTasks,type TaskGrant} from '../cloud-tasks.js';
import {TaskSigner,VefaasTaskTransport,taskApp} from '../task-http.js';
import {ObjectTemporaryMedia,type TemporaryObjects} from '../temporary-media.js';
import {Admin} from '../admin.js';
import {InviteAccess,generateInvites,configSchema} from '../access.js';
import {captureTaskGrant,resolveTaskIdentity} from '../task-identity.js';
import {createApp} from '../app.js';
import {copyInput} from '../../shared/ai-copy.js';
import {AICopy} from '../ai-copy.js';
import {CopySettingsStore} from '../copy-settings.js';
import {CopyPromptStore} from '../copy-prompt.js';
import {Fault} from '../../shared/contracts.js';

class Objects implements TemporaryObjects {
 rows=new Map<string,{bytes:Buffer;etag:string}>();afterPut?:()=>void;
 async get(k:string){return this.rows.get(k)||null;}
 async put(k:string,bytes:Buffer,etag:string|null){if((this.rows.get(k)?.etag??null)!==etag)return false;this.rows.set(k,{bytes:Buffer.from(bytes),etag:randomUUID()});this.afterPut?.();return true;}
 async removeTemporary(k:string){this.rows.delete(k);}
}
const encryption=()=>{const key=randomBytes(32);return {
 seal:(s:string)=>{const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key,iv),body=Buffer.concat([c.update(s),c.final()]);return Buffer.concat([iv,c.getAuthTag(),body]).toString('base64');},
 unseal:(s:string)=>{const b=Buffer.from(s,'base64'),c=createDecipheriv('aes-256-gcm',key,b.subarray(0,12));c.setAuthTag(b.subarray(12,28));return Buffer.concat([c.update(b.subarray(28)),c.final()]).toString();}
};};
const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return {promise,resolve};};
const grant:TaskGrant={type:'account',digest:'a'.repeat(64)};
const input=()=>copyInput.parse({operationId:randomUUID(),bookId:'book',pageId:'page',sourceRevision:'a'.repeat(64),mode:'generate',topic:'仅用于测试的私密文字'});
const result={text:'测试文案',provider:'test' as const,model:'fixture'};
async function listen(app:ReturnType<typeof taskApp>){const server=app.listen(0,'127.0.0.1');await new Promise<void>((r,j)=>{server.once('listening',r);server.once('error',j);});return {server,base:`http://127.0.0.1:${(server.address() as {port:number}).port}`};}
const close=(s:Server)=>new Promise<void>(r=>{s.close(()=>r());s.closeAllConnections();});

test('outbox input is encrypted; transport failure and lost acknowledgement recover across instances',async()=>{
 const objects=new Objects(),crypt=encryption();let now=Date.now(),calls=0;const sent:string[]=[];
 const instance=()=>new CloudTasks(new ObjectDocumentGroup(objects,'shared'),crypt.seal,crypt.unseal,{notify:async id=>{calls++;sent.push(id);throw Error('synthetic uncertain response');}},()=>now);
 const a=instance();await a.init();const operationId=randomUUID(),id=await a.reserve('copy','account:fixture',operationId,{topic:'private fixture'},grant);
 await a.notifyOperation('copy','account:fixture',operationId);assert.equal(calls,1);
 const b=instance();await b.init();await b.maintain();assert.equal(calls,1);now+=60001;await b.maintain();assert.equal(calls,2);assert.equal(sent[0],sent[1]);
 const raw=objects.rows.get('shared')!.bytes.toString();assert.ok(!raw.includes('private fixture'));assert.ok(!raw.includes(grant.digest));
 let runs=0;const gate=deferred(),started=deferred();
 const worker=b.execute(id,async task=>{runs++;assert.deepEqual(task.input,{topic:'private fixture'});started.resolve();await gate.promise;});
 await started.promise;await a.execute(id,async()=>{runs++;});assert.equal(runs,1);gate.resolve();await worker;
 await a.execute(id,async()=>{runs++;});assert.equal(runs,1);assert.ok(!objects.rows.get('shared')!.bytes.toString().includes('"cipher"'));
});

test('business reservation and outbox roll back together; unknown committed response never launches work',async()=>{
 const objects=new Objects(),crypt=encryption(),documents=new ObjectDocumentGroup(objects,'shared'),tasks=new CloudTasks(documents,crypt.seal,crypt.unseal,{notify:async()=>{throw Error('must not send');}});
 await tasks.init();const business=documents.cell('business',x=>x as {count:number});await business.initialize({count:0});
 await assert.rejects(documents.transaction(async()=>{await business.update(s=>s.count++);await tasks.reserve('copy','fixture',randomUUID(),{},grant);throw Error('validation');}));
 assert.equal((await business.read()).count,0);assert.equal(JSON.parse(objects.rows.get('shared')!.bytes.toString()).values['cloud-tasks'].tasks.length,0);
 objects.afterPut=()=>{throw Error('lost reply after commit');};
 await assert.rejects(documents.transaction(async()=>{await business.update(s=>s.count++);await tasks.reserve('copy','fixture',randomUUID(),{},grant);}));
 objects.afterPut=undefined;assert.equal((await business.read()).count,1);assert.equal(JSON.parse(objects.rows.get('shared')!.bytes.toString()).values['cloud-tasks'].tasks.length,1);
});

test('failed worker lease is bounded and recovered, expired payloads are removed without work',async()=>{
 const objects=new Objects(),crypt=encryption();let now=Date.now();const documents=new ObjectDocumentGroup(objects,'shared'),tasks=new CloudTasks(documents,crypt.seal,crypt.unseal,{notify:async()=>{}},()=>now,1000);
 await tasks.init();const id=await tasks.reserve('copy','fixture',randomUUID(),{},grant);let calls=0;
 await assert.rejects(tasks.execute(id,async()=>{calls++;throw Error('synthetic interruption');}));
 await tasks.execute(id,async()=>{calls++;});assert.equal(calls,1);now+=1001;await tasks.maintain();await tasks.execute(id,async()=>{calls++;});assert.equal(calls,2);
 const expired=await tasks.reserve('copy','fixture',randomUUID(),{},grant);now+=CloudTasks.queueMs+1;await tasks.maintain();await tasks.execute(expired,async()=>{calls++;});assert.equal(calls,2);assert.ok(!objects.rows.get('shared')!.bytes.toString().includes('"cipher"'));
});

test('worker HTTP rejects unsigned/tampered commands and waits for completion; maintenance survives cleanup failure',async()=>{
 const objects=new Objects(),crypt=encryption();let sent=0;const tasks=new CloudTasks(new ObjectDocumentGroup(objects,'shared'),crypt.seal,crypt.unseal,{notify:async()=>{sent++;}});await tasks.init();
 const id=await tasks.reserve('copy','fixture',randomUUID(),{},grant),signer=new TaskSigner(randomBytes(32)),gate=deferred(),started=deferred();let runs=0;
 const {server,base}=await listen(taskApp(tasks,signer,async()=>{runs++;started.resolve();await gate.promise;},async()=>{throw Error('synthetic cleanup failure');}));
 const post=(value:unknown)=>fetch(base,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(value)});
 try{
  assert.equal((await post({kind:'execute',taskId:id})).status,403);
  assert.equal((await post({...signer.execute(id),taskId:randomUUID()})).status,403);
  assert.equal((await fetch(base+'/api/health')).status,404);assert.equal(runs,0);
  let returned=false;const response=post(signer.execute(id)).then(r=>{returned=true;return r;});await started.promise;assert.equal(returned,false);
  gate.resolve();assert.equal((await response).status,204);assert.equal((await post(signer.execute(id))).status,204);assert.equal(runs,1);
  await tasks.reserve('copy','fixture',randomUUID(),{},grant);assert.equal((await post(signer.maintenance())).status,503);assert.equal(sent,1);
 }finally{gate.resolve();await close(server);}
});

test('gateway sender transmits only a signed ID, requires async 202 and disallows redirect',async()=>{
 const signer=new TaskSigner(randomBytes(32)),id=randomUUID();let count=0;
 const transport=new VefaasTaskTransport('https://worker.example.test/',signer,async(url,init)=>{count++;assert.equal(url,'https://worker.example.test/');assert.equal(init?.redirect,'error');assert.equal(init?.method,'POST');assert.deepEqual(JSON.parse(String(init?.body)),signer.execute(id));return new Response(null,{status:202});});
 await transport.notify(id);assert.equal(count,1);
 await assert.rejects(new VefaasTaskTransport('https://worker.example.test/',signer,async()=>new Response(null,{status:200})).notify(id));
 assert.throws(()=>new VefaasTaskTransport('http://worker.example.test/',signer));
});

test('fresh task authorization rejects logout, password change, disabled and bound invites',async()=>{
 const objects=new Objects(),documents=new ObjectDocumentGroup(objects,'shared'),access=new InviteAccess('/unused/access',undefined,documents),generated=generateInvites(2);
 await documents.cell('invites',v=>configSchema.parse(v)).initialize(generated.config);
 const admin=new Admin('/unused/admin',access,undefined,{documents,encryptionKey:randomBytes(32)}),initial={username:'管理员测试',password:'Synthetic-Password-123!'};
 await admin.init({apiKey:'',secretKey:'',cutout:false,naming:false},initial);
 let token=await admin.login(initial.username,initial.password,'fixture');let g=await captureTaskGrant(admin,token);const who=await admin.resolveSession(token),owner='account:'+who!.accountId;
 assert.equal((await resolveTaskIdentity(admin,g,owner)).owner,owner);await assert.rejects(resolveTaskIdentity(admin,g,'account:'+randomUUID()));
 await admin.logout(token);await assert.rejects(resolveTaskIdentity(admin,g,owner));
 token=await admin.login(initial.username,initial.password,'fixture2');g=await captureTaskGrant(admin,token);await admin.setPassword(who!.accountId,initial.password,'Synthetic-New-Password-123!');await assert.rejects(resolveTaskIdentity(admin,g,owner));
 const invite=await access.verify(generated.codes[0],'fixture','fixture');const ig=await captureTaskGrant(admin,undefined,invite.token);assert.equal(ig.type,'invite');if(ig.type!=='invite')throw Error();
 await resolveTaskIdentity(admin,ig,'invite:'+ig.inviteId);await access.update(s=>{s.invites[0].status='disabled';});await assert.rejects(resolveTaskIdentity(admin,ig,'invite:'+ig.inviteId));
 await access.update(s=>{s.invites[0].status='bound';s.invites[0].grantVersion=1;});await assert.rejects(resolveTaskIdentity(admin,ig,'invite:'+ig.inviteId));
});

test('stale cloud worker cannot replay a dispatched AI operation after outbox recovery',async()=>{
 const objects=new Objects(),crypt=encryption();let now=Date.now(),calls=0;const documents=new ObjectDocumentGroup(objects,'shared'),tasks=new CloudTasks(documents,crypt.seal,crypt.unseal,{notify:async()=>{}},()=>now,1000);await tasks.init();
 const settings=new CopySettingsStore('/unused/settings',crypt.seal,crypt.unseal,()=>now,new CopyPromptStore('/unused/prompt',documents),documents);
 const copy=new AICopy('/unused/copy',settings,crypt.seal,crypt.unseal,{generate:async()=>{calls++;return result;}},()=>now,45000,documents,tasks);await copy.init();
 const value=input(),who={owner:'account:'+randomUUID()};await copy.submit(async()=>who,value,grant);await copy.idle();assert.equal(calls,0);
 const row=JSON.parse(objects.rows.get('shared')!.bytes.toString()).values['cloud-tasks'].tasks[0];
 await assert.rejects(tasks.execute(row.id,async task=>{await copy.execute(task.owner,task.input,async()=>who);throw Error('crash after saved AI result');}));assert.equal(calls,1);
 now+=1001;await tasks.maintain();await tasks.execute(row.id,async task=>{await copy.execute(task.owner,task.input,async()=>who);});assert.equal(calls,1);assert.equal((await copy.status(who)).used,1);
});

test('public API returns queued work, second HTTP worker completes it, and revoked queued work never reaches AI',async()=>{
 const objects=new Objects(),key=randomBytes(32),signer=new TaskSigner(randomBytes(32)),generated=generateInvites(1),initial={username:'后台测试',password:'Synthetic-Password-123!'};
 await new ObjectDocumentGroup(objects,'shared').cell('invites',v=>configSchema.parse(v)).initialize(generated.config);
 const sent:string[]=[],servers:Server[]=[];let calls=0;
 const make=async()=>{
  const documents=new ObjectDocumentGroup(objects,'shared'),access=new InviteAccess('/unused/access',undefined,documents),admin=new Admin('/unused/admin',access,undefined,{documents,encryptionKey:key});await admin.init({apiKey:'',secretKey:'',cutout:false,naming:false},initial);
  const tasks=new CloudTasks(documents,s=>admin.sealProviderData(s),s=>admin.openProviderData(s),{notify:async id=>{sent.push(id);}});
  const application=await createApp({runtime:await mkdtemp(join(tmpdir(),'shiye-cloud-http-')),staticRoot:resolve('shiye-editorial-prototype'),access,admin,aiDocuments:documents,taskStorage:{documents,media:new ObjectTemporaryMedia(objects)},cloudTasks:{tasks,signer},latency:1,copyProvider:{generate:async()=>{calls++;return result;}}});return {...application,admin,tasks};
 };
 try{
  const a=await make(),b=await make(),web=await listen(a.app),worker=await listen(b.workerApp!);servers.push(web.server,worker.server);
  const session=await fetch(web.base+'/api/access/session');let cookie=session.headers.getSetCookie()[0].split(';')[0],owner='';
  const req=(path:string,body?:unknown)=>fetch(web.base+path,{method:body===undefined?'GET':'POST',headers:{cookie,origin:web.base,'content-type':'application/json','x-shiye-copy-owner':owner},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const login=await req('/api/access/login',initial);assert.equal(login.status,200);owner='account:'+(await login.json()).account.id;cookie+='; '+login.headers.getSetCookie().find(c=>c.startsWith('shiye_admin='))!.split(';')[0];
  const postWorker=(id:string)=>fetch(worker.base,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(signer.execute(id))});
  const value=input();const submitted=await req('/api/ai/copy',value);assert.equal(submitted.status,202);assert.equal((await submitted.json()).status,'pending');assert.equal(calls,0);assert.equal(sent.length,1);
  assert.equal((await postWorker(sent[0])).status,204);assert.equal((await (await req('/api/ai/copy/'+value.operationId)).json()).text,result.text);assert.equal(calls,1);
  const photo=await(await req('/api/uploads/photo/init',{operationId:randomUUID(),fixture:true})).json();
  const jobResponse=await req('/api/segmentation/jobs',{operationId:randomUUID(),imageSessionId:photo.imageSessionId,objectKey:photo.objectKey,sourceRevision:photo.sourceRevision});assert.equal(jobResponse.status,202);const job=await jobResponse.json();assert.equal(job.status,'queued');assert.equal(sent.length,2);
  await a.jobs.idle();assert.equal((await (await req('/api/jobs/'+job.jobId)).json()).status,'queued');assert.equal((await postWorker(sent[1])).status,204);assert.equal((await (await req('/api/jobs/'+job.jobId)).json()).status,'succeeded');
  const next=input();await req('/api/ai/copy',next);assert.equal(sent.length,3);await req('/api/account/logout',{});assert.equal((await postWorker(sent[2])).status,204);assert.equal(calls,1);assert.equal((await b.copy!.get({owner},next.operationId)).error?.errorType,'TASK_ACCESS_REVOKED');
  const raw=objects.rows.get('shared')!.bytes.toString();assert.ok(!raw.includes(value.topic));assert.ok(!raw.includes(initial.password));
 }finally{await Promise.all(servers.map(close));}
});
