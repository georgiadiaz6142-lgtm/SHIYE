import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes,createCipheriv,createDecipheriv} from 'node:crypto';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import sharp from 'sharp';
import {AICopy,copyMonth,type CopyIdentity} from '../ai-copy.js';
import {CopySettingsStore} from '../copy-settings.js';
import {ArkCopyProvider,ARK_COPY_ENDPOINT,CopyProviderFault,validateCopyThumbnail,type CopyProvider} from '../copy-provider.js';
import {copyInput} from '../../shared/ai-copy.js';
import {Admin} from '../admin.js';
import {InviteAccess,generateInvites} from '../access.js';
import {createApp} from '../app.js';
const valid=()=>copyInput.parse({operationId:randomUUID(),bookId:'test-book',pageId:'test-page',sourceRevision:'a'.repeat(64),mode:'generate',topic:'周末在家看书'});
const identity:CopyIdentity={owner:'account:'+randomUUID()};
const result={text:'午后的光落在书页上，慢慢读几页，让今天的脚步也跟着放缓。',provider:'test' as const,model:'fixture',usage:{inputTokens:120,outputTokens:45}};
const fault=(type:string)=>(e:any)=>e.errorType===type;
async function fixture(provider?:CopyProvider,timeout=45000){
 const dir=await mkdtemp(join(tmpdir(),'shiye-copy-test-')),key=randomBytes(32);let now=Date.parse('2026-09-10T02:00:00Z');
 const seal=(v:string)=>{const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key,iv),data=Buffer.concat([c.update(v,'utf8'),c.final()]);return Buffer.concat([iv,c.getAuthTag(),data]).toString('base64');};
 const unseal=(v:string)=>{const b=Buffer.from(v,'base64'),d=createDecipheriv('aes-256-gcm',key,b.subarray(0,12));d.setAuthTag(b.subarray(12,28));return Buffer.concat([d.update(b.subarray(28)),d.final()]).toString('utf8');};
 const settings=new CopySettingsStore(join(dir,'config.json'),seal,unseal,()=>now),copy=new AICopy(join(dir,'state.json'),settings,seal,unseal,provider,()=>now,timeout);await copy.init();
 return {dir,settings,copy,seal,unseal,now:()=>now,setNow:(v:number)=>{now=v;}};
}
test('copy configuration is disabled by default, encrypted, revision guarded and independent of provider calls',async()=>{
 const f=await fixture();assert.equal(await f.settings.available(),false);assert.equal((await f.copy.status(identity)).enabled,false);
 await assert.rejects(f.copy.submit(async()=>identity,valid()),fault('COPY_DISABLED'));assert.equal((await f.copy.usage()).attempts,0);
 const config={revision:0,apiKey:'fixture-secret-key',model:'fixture-model',enabled:true,maxCalls:4,approvedUntil:f.now()+60000,inputRate:1,outputRate:2};
 await assert.rejects(f.settings.save('test',{...config,approvedUntil:null}),fault('COPY_APPROVAL_REQUIRED'));
 await f.settings.save('test',config);assert.equal(await f.settings.available(),true);assert.ok(!(await readFile(f.settings.file,'utf8')).includes(config.apiKey));assert.ok(!JSON.stringify(await f.settings.public()).includes(config.apiKey));
 await assert.rejects(f.settings.save('test',config),fault('CONFIG_CHANGED'));
 await assert.rejects(f.settings.save('test',{...config,revision:1,endpoint:'https://example.com'}));
 await f.settings.save('test',{...config,revision:1,apiKey:'',enabled:false});assert.equal((await f.settings.public()).configured,true);assert.equal(await f.settings.available(),false);
 assert.equal((await f.copy.usage()).attempts,0);
});
test('Ark adapter sends only explicit context and thumbnail, validates JSON and sanitizes supplier failures',async()=>{
 const input=valid();input.thumbnail='data:image/jpeg;base64,'+(await sharp({create:{width:80,height:80,channels:3,background:'white'}}).jpeg().toBuffer()).toString('base64');await validateCopyThumbnail(input);
 let calls=0;const provider=new ArkCopyProvider('fixture-secret','fixture-model',async(url,options)=>{calls++;assert.equal(url,ARK_COPY_ENDPOINT);assert.equal(options?.redirect,'error');const body=JSON.parse(String(options?.body));assert.equal(body.stream,false);assert.equal(body.response_format.type,'json_object');assert.equal(body.messages[1].content[1].image_url.url,input.thumbnail);for(const key of ['bookId','pageId','sourceRevision','operationId'])assert.ok(!String(options?.body).includes(key));return new Response(JSON.stringify({id:'test-request',choices:[{finish_reason:'stop',message:{content:JSON.stringify({text:result.text})}}],usage:{prompt_tokens:120,completion_tokens:45}}));});
 const r=await provider.generate(input,new AbortController().signal);assert.equal(r.text,result.text);assert.deepEqual(r.usage,result.usage);assert.equal(calls,1);
 for(const code of [401,429,500]){const bad=new ArkCopyProvider('secret','model',async()=>new Response('private-provider-content',{status:code}));await assert.rejects(bad.generate(valid(),new AbortController().signal),(e:any)=>e instanceof CopyProviderFault&&!e.message.includes('private'));}
 for(const content of ['not JSON',JSON.stringify({text:'<script>bad</script>'}),JSON.stringify({text:'hello',extra:true})]){const bad=new ArkCopyProvider('key','model',async()=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content}}],usage:{prompt_tokens:1,completion_tokens:2}})));await assert.rejects(bad.generate(valid(),new AbortController().signal),(e:any)=>e.errorType==='COPY_RESULT_INVALID'&&e.usage.inputTokens===1);}
 await assert.rejects(validateCopyThumbnail({...valid(),thumbnail:'data:image/jpeg;base64,aGVsbG8='}),fault('COPY_THUMBNAIL_INVALID'));
 const huge=await sharp({create:{width:513,height:2,channels:3,background:'white'}}).jpeg().toBuffer();await assert.rejects(validateCopyThumbnail({...valid(),thumbnail:'data:image/jpeg;base64,'+huge.toString('base64')}));
});
test('concurrent retry reserves once, invitation quota is shared and success previews consume exactly one',async()=>{
 let calls=0,release!:()=>void,started!:()=>void;const dispatched=new Promise<void>(r=>started=r);const gate=new Promise<void>(r=>release=r),f=await fixture({generate:async()=>{calls++;started();await gate;return result;}}),guest={owner:'invite:'+randomUUID()},input=valid();
 await Promise.all(Array.from({length:8},()=>f.copy.submit(async()=>guest,input)));assert.equal((await f.copy.status(guest)).pending,1);await dispatched;assert.equal(calls,1);
 await assert.rejects(f.copy.submit(async()=>guest,{...input,topic:'changed'}),fault('COPY_OPERATION_CONFLICT'));release();await f.copy.idle();assert.equal((await f.copy.status(guest)).used,1);
 await f.copy.submit(async()=>guest,input);assert.equal(calls,1);assert.equal((await f.copy.get(guest,input.operationId)).text,result.text);
 for(let i=0;i<2;i++){await f.copy.submit(async()=>({...guest}),valid());await f.copy.idle();}
 assert.equal((await f.copy.status(guest)).remaining,0);await assert.rejects(f.copy.submit(async()=>guest,valid()),fault('COPY_QUOTA_EXHAUSTED'));
 assert.equal((await f.copy.usage()).attempts,3);await assert.rejects(f.copy.get(identity,input.operationId),fault('COPY_NOT_FOUND'));
 const disk=await readFile(f.copy.file,'utf8');assert.ok(!disk.includes(result.text));assert.ok(!disk.includes(input.topic));assert.ok(!disk.includes('thumbnail'));
});
test('account month, inherited invitation usage, membership total and Shanghai rollover agree',async()=>{
 const f=await fixture({generate:async()=>result}),inviteId=randomUUID(),guest={owner:'invite:'+inviteId};for(let i=0;i<3;i++){await f.copy.submit(async()=>guest,valid());await f.copy.idle();}
 const account={...identity,inviteId,registeredAt:f.now()};assert.equal((await f.copy.status(account)).remaining,7);
 for(let i=0;i<7;i++){await f.copy.submit(async()=>account,valid());await f.copy.idle();}assert.equal((await f.copy.status(account)).used,10);await assert.rejects(f.copy.submit(async()=>account,valid()),fault('COPY_QUOTA_EXHAUSTED'));
 assert.equal((await f.copy.status({...account,member:true})).remaining,90);assert.equal((await f.copy.status({...account,member:true})).limit,100);
 f.setNow(Date.parse('2026-09-30T16:00:00Z'));assert.equal(copyMonth(f.now()),'2026-10');assert.equal((await f.copy.status(account)).remaining,10);assert.equal((await f.copy.status(guest)).remaining,0);
});
test('failure, timeout and interrupted process release user quota while retaining supplier attempts',async()=>{
 const f=await fixture({generate:async()=>{throw new CopyProviderFault(502,'COPY_RESULT_INVALID','无效结果',result.usage);}});
 await f.settings.save('test',{revision:0,apiKey:'',model:'',enabled:false,maxCalls:5,approvedUntil:null,inputRate:1,outputRate:2});
 const input=valid();await f.copy.submit(async()=>identity,input);await f.copy.idle();assert.equal((await f.copy.status(identity)).used,0);assert.equal((await f.copy.get(identity,input.operationId)).charged,false);const usage=await f.copy.usage();assert.equal(usage.attempts,1);assert.equal(usage.items[0].billing,'usage-reported');assert.equal(usage.knownEstimatedYuan,.00021);
 const timed=await fixture({generate:()=>new Promise(()=>{})},10);await timed.copy.submit(async()=>identity,valid());await timed.copy.idle();assert.equal((await timed.copy.usage()).unknownBilling,1);assert.equal((await timed.copy.status(identity)).pending,0);
 const pending=JSON.parse(await readFile(f.copy.file,'utf8'));pending.operations[0].status='pending';delete pending.operations[0].finishedAt;await writeFile(f.copy.file,JSON.stringify(pending));await f.copy.init();assert.equal((await f.copy.get(identity,input.operationId)).error?.errorType,'COPY_INTERRUPTED');assert.equal((await f.copy.usage()).attempts,1);
});
test('cumulative supplier cap includes failed attempts, expired previews stay charged, authorization can change before dispatch',async()=>{
 const f=await fixture({generate:async()=>result}),input=valid();await f.copy.submit(async()=>identity,input);await f.copy.idle();f.setNow(f.now()+86400001);assert.equal((await f.copy.get(identity,input.operationId)).previewExpired,true);assert.equal((await f.copy.status(identity)).used,1);await f.copy.init();assert.ok(!(await readFile(f.copy.file,'utf8')).includes('resultCipher'));
 await f.settings.save('test',{revision:0,apiKey:'fixture-key',model:'fixture',enabled:true,maxCalls:1,approvedUntil:f.now()+100000,inputRate:null,outputRate:null});
 const capped=new AICopy(f.copy.file,f.settings,f.seal,f.unseal,undefined,f.now);await assert.rejects(capped.submit(async()=>identity,valid()),fault('COPY_SERVICE_LIMIT'));assert.equal((await capped.usage()).attempts,1);
 const fresh=await fixture({generate:async()=>result});let checks=0;await assert.rejects(fresh.copy.submit(async()=>++checks===1?identity:{owner:'account:other'},valid()),fault('COPY_IDENTITY_CHANGED'));assert.equal((await fresh.copy.usage()).attempts,0);
});
test('copy HTTP routes enforce identity, admin permissions, strict input and CSRF without calling real provider',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'shiye-copy-http-')),batch=generateInvites(2),file=join(dir,'invites.json');await writeFile(file,JSON.stringify(batch.config));const access=new InviteAccess(file),admin=new Admin(join(dir,'admin.json'),access);await admin.init({apiKey:'fixture',secretKey:'fixture',cutout:false,naming:false},join(dir,'receipt'));
 let calls=0;const {app,copy}=await createApp({runtime:join(dir,'runtime'),staticRoot:resolve('shiye-editorial-prototype'),access,admin,copyProvider:{generate:async()=>{calls++;return result;}}});const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base='http://127.0.0.1:'+(server.address() as {port:number}).port;
 try{const session=(await fetch(base+'/api/access/session')).headers.getSetCookie()[0].split(';')[0],grant=await access.verify(batch.codes[0],'fixture','local'),headers={origin:base,'content-type':'application/json',cookie:session+'; shiye_invite='+grant.token,'x-shiye-copy-owner':'invite:'+batch.config.invites[0].id};
 assert.equal((await fetch(base+'/api/ai/copy/status')).status,401);assert.equal((await fetch(base+'/api/ai/copy/status',{headers})).status,200);assert.equal((await fetch(base+'/api/admin/copy/usage',{headers})).status,403);assert.equal((await fetch(base+'/api/admin/copy/prompt',{headers})).status,403);assert.equal((await fetch(base+'/api/admin/copy/prompt',{method:'POST',headers,body:JSON.stringify({revision:0,text:'unauthorized'})})).status,403);assert.equal((await fetch(base+'/api/admin/apis/copy',{method:'POST',headers,body:'{}'})).status,403);
 assert.equal((await fetch(base+'/api/ai/copy',{method:'POST',headers:{...headers,origin:'https://foreign.example'},body:JSON.stringify(valid())})).status,403);
 assert.equal((await fetch(base+'/api/ai/copy',{method:'POST',headers,body:JSON.stringify({...valid(),member:true})})).status,422);
 const input=valid();assert.equal((await fetch(base+'/api/ai/copy',{method:'POST',headers,body:JSON.stringify(input)})).status,202);await copy!.idle();assert.equal(calls,1);
 const user=await admin.register(grant.token,{username:'copy-user',password:'fixture-password-123'}),token=await admin.login('copy-user','fixture-password-123','local');headers.cookie=session+'; shiye_admin='+token;
 assert.equal((await fetch(base+'/api/ai/copy/status',{headers})).status,409);headers['x-shiye-copy-owner']='account:'+user.id;assert.equal((await(await fetch(base+'/api/ai/copy/status',{headers})).json()).remaining,9);
 assert.equal((await fetch(base+'/api/ai/copy/'+input.operationId,{headers})).status,404);assert.equal((await fetch(base+'/api/admin/copy/usage',{headers})).status,403);assert.equal((await fetch(base+'/api/admin/copy/prompt',{headers})).status,403);assert.equal((await fetch(base+'/api/admin/copy/prompt',{method:'POST',headers,body:JSON.stringify({revision:0,text:'unauthorized'})})).status,403);
 }finally{await copy!.idle();await new Promise<void>(r=>server.close(()=>r()));}
});
