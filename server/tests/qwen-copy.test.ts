import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import sharp from 'sharp';
import {QwenCopyProvider,QWEN_COPY_ENDPOINT,QWEN_COPY_MODEL,ArkCopyProvider,CopyProviderFault} from '../copy-provider.js';
import {CopySettingsStore} from '../copy-settings.js';
import {CopyPromptStore} from '../copy-prompt.js';
import {AICopy} from '../ai-copy.js';
import {copyInput} from '../../shared/ai-copy.js';
import {copySource} from '../../shared/copy-source.js';
const valid=()=>copyInput.parse({operationId:randomUUID(),bookId:'qwen-book',pageId:'qwen-page',sourceRevision:'a'.repeat(64),mode:'generate',topic:'周末读书'});
const response=(text='慢慢读几页，留一点时间给自己。')=>new Response(JSON.stringify({id:'fixture-request',choices:[{finish_reason:'stop',message:{content:JSON.stringify({text})}}],usage:{prompt_tokens:2000,completion_tokens:200}}));
const fault=(type:string)=>(e:any)=>e.errorType===type;
test('Qwen sends only intended text and image to the Beijing allowlisted endpoint, disables thinking and enforces the JSON schema',async()=>{
 const input=valid();input.thumbnail='data:image/jpeg;base64,'+(await sharp({create:{width:40,height:40,channels:3,background:'white'}}).jpeg().toBuffer()).toString('base64');
 const controller=new AbortController();let calls=0;
 const provider=new QwenCopyProvider('fixture-secret',QWEN_COPY_MODEL,async(url,options)=>{
  calls++;assert.equal(url,QWEN_COPY_ENDPOINT);assert.equal(options?.redirect,'error');assert.equal(options?.signal,controller.signal);
  const body=JSON.parse(String(options?.body));assert.equal(body.model,QWEN_COPY_MODEL);assert.equal(body.enable_thinking,false);assert.equal(body.stream,false);assert.equal(body.max_tokens,512);
  assert.equal(body.response_format.type,'json_schema');assert.equal(body.response_format.json_schema.strict,true);assert.deepEqual(body.response_format.json_schema.schema.required,['text']);assert.equal(body.response_format.json_schema.schema.additionalProperties,false);
  assert.equal(body.messages[0].content,'管理员修改后的文风要求');assert.equal(body.messages[1].content[1].image_url.url,input.thumbnail);
  for(const key of ['bookId','pageId','sourceRevision','operationId'])assert.ok(!String(options?.body).includes(key));return response();
 },'管理员修改后的文风要求');
 const result=await provider.generate(input,controller.signal);assert.equal(calls,1);assert.equal(result.provider,'qwen');assert.deepEqual(result.usage,{inputTokens:2000,outputTokens:200});
 assert.equal(copySource.parse({version:1,kind:'copy',operationId:input.operationId,provider:result.provider,model:result.model,generatedAt:Date.now()}).provider,'qwen');
});
test('Qwen never retries or exposes supplier errors; invalid and truncated replies retain reported billing usage',async()=>{
 for(const status of [400,401,403,404,429,500]){let calls=0;const p=new QwenCopyProvider('fixture-secret',QWEN_COPY_MODEL,async()=>{calls++;return new Response('secret-private-provider-body',{status});});await assert.rejects(p.generate(valid(),new AbortController().signal),(e:any)=>e instanceof CopyProviderFault&&!e.message.includes('secret'));assert.equal(calls,1);}
 for(const [finish_reason,content] of [['stop','not JSON'],['length','{"text":"partial"}'],['stop','{"text":"ok","extra":true}'],['stop','{"text":"<script>bad</script>"}']]){
  const p=new QwenCopyProvider('fixture-secret',QWEN_COPY_MODEL,async()=>new Response(JSON.stringify({choices:[{finish_reason,message:{content}}],usage:{prompt_tokens:2,completion_tokens:3}})));
  await assert.rejects(p.generate(valid(),new AbortController().signal),(e:any)=>e.errorType==='COPY_RESULT_INVALID'&&e.usage.inputTokens===2);
 }
 const p=new QwenCopyProvider('fixture-secret',QWEN_COPY_MODEL,async()=>{throw Error('secret transport data');});await assert.rejects(p.generate(valid(),new AbortController().signal),fault('COPY_NETWORK_FAILED'));
});
test('Qwen settings default disabled, legacy Ark configuration remains readable and switching cannot reuse another provider key',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'shiye-qwen-config-')),file=join(dir,'config.json'),prompts=new CopyPromptStore(join(dir,'prompt.json'));
 const store=new CopySettingsStore(file,s=>'sealed:'+s,s=>s.slice(7),undefined,prompts);
 assert.equal((await store.public()).providerId,'qwen');assert.equal((await store.public()).model,QWEN_COPY_MODEL);assert.equal(await store.available(),false);
 const legacy={version:1,revision:1,cipher:'sealed:fixture-ark-key',model:'legacy-ark-model',enabled:true,maxCalls:10,approvedUntil:Date.now()+60000,inputRate:1,outputRate:2,updatedAt:1,actor:'fixture'};
 await writeFile(file,JSON.stringify(legacy));assert.equal((await store.public()).providerId,'ark');assert.ok(await store.provider() instanceof ArkCopyProvider);
 const payload={revision:1,providerId:'qwen',apiKey:'',model:QWEN_COPY_MODEL,enabled:true,maxCalls:10,approvedUntil:Date.now()+60000,inputRate:0.2,outputRate:0.8};
 await assert.rejects(store.save('fixture',payload),fault('COPY_PROVIDER_KEY_REQUIRED'));assert.deepEqual(JSON.parse(await readFile(file,'utf8')),legacy);
 await assert.rejects(store.save('fixture',{...payload,providerId:'other',apiKey:'fixture-qwen-key'}));await assert.rejects(store.save('fixture',{...payload,apiKey:'fixture-qwen-key',endpoint:'https://example.com'}));
 await store.save('fixture',{...payload,apiKey:'fixture-qwen-key'});assert.ok(await store.provider() instanceof QwenCopyProvider);assert.equal((await store.public()).endpoint,QWEN_COPY_ENDPOINT);assert.ok(!JSON.stringify(await store.public()).includes('fixture-qwen-key'));
 const {providerId:_,...oldClient}=payload;await store.save('fixture',{...oldClient,revision:2,enabled:false});assert.equal((await store.read()).providerId,'qwen');assert.equal((await store.read()).cipher,'sealed:fixture-qwen-key');
 await assert.rejects(store.save('fixture',{...payload,revision:2}),fault('CONFIG_CHANGED'));
});
test('Qwen successful preview persists its provider and cost, while polling and reopening do not call again',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'shiye-qwen-job-')),seal=(s:string)=>Buffer.from(s).toString('base64'),unseal=(s:string)=>Buffer.from(s,'base64').toString();
 const settings=new CopySettingsStore(join(dir,'settings.json'),seal,unseal);let calls=0;
 const provider=new QwenCopyProvider('fixture-key',QWEN_COPY_MODEL,async()=>{calls++;return response();});
 const copy=new AICopy(join(dir,'jobs.json'),settings,seal,unseal,provider);await copy.init();const identity={owner:'account:'+randomUUID()},input=valid();
 await copy.submit(async()=>identity,input);await copy.idle();const preview=await copy.get(identity,input.operationId);assert.equal(preview.status,'succeeded');assert.equal(preview.source?.provider,'qwen');assert.equal(preview.charged,true);
 await copy.submit(async()=>identity,input);const reopened=new AICopy(copy.file,settings,seal,unseal,provider);await reopened.init();assert.equal((await reopened.get(identity,input.operationId)).source?.provider,'qwen');assert.equal(calls,1);
 assert.equal((await copy.usage()).knownEstimatedYuan,0.00056);assert.equal((await copy.status(identity)).used,1);
});
