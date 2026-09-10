import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,readFile} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';import {randomUUID} from 'node:crypto';
import {CopyPromptStore,DEFAULT_COPY_PROMPT} from '../copy-prompt.js';import {CopySettingsStore} from '../copy-settings.js';import {copyInput} from '../../shared/ai-copy.js';
test('admin prompt supports default, revision-guarded save, reload and reset independently of API configuration',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'shiye-prompt-')),store=new CopyPromptStore(join(dir,'prompt.json'));
 assert.equal((await store.public()).text,DEFAULT_COPY_PROMPT);assert.ok(DEFAULT_COPY_PROMPT.includes('40～100'));assert.ok(DEFAULT_COPY_PROMPT.includes('图片直接当成用户的亲身经历'));
 await assert.rejects(store.save('fixture',{revision:0,text:'  '}));await assert.rejects(store.save('fixture',{revision:0,text:'a'.repeat(12001)}));await assert.rejects(store.save('fixture',{revision:0,text:'a',apiKey:'unrelated'}));
 await store.save('fixture',{revision:0,text:'测试提示词：请写得简短自然。'});await assert.rejects(store.save('other',{revision:0,text:'旧页面的保存'}),(e:any)=>e.errorType==='COPY_PROMPT_CHANGED');
 const reload=new CopyPromptStore(store.file),saved=await reload.public();assert.equal(saved.text,'测试提示词：请写得简短自然。');assert.equal(saved.actor,'fixture');assert.ok(saved.updatedAt>0);
 await reload.save('fixture',{revision:1,text:saved.defaultText});assert.equal((await store.read()).text,DEFAULT_COPY_PROMPT);assert.equal(JSON.parse(await readFile(store.file,'utf8')).revision,2);
 const settings=new CopySettingsStore(join(dir,'config.json'),s=>s,s=>s,undefined,store);assert.equal(await settings.available(),false);assert.equal((await settings.public()).configured,false);
});
test('new provider requests use saved prompt; an already prepared request retains its prompt snapshot',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'shiye-prompt-request-')),prompts=new CopyPromptStore(join(dir,'prompt.json')),settings=new CopySettingsStore(join(dir,'config.json'),s=>'sealed:'+s,s=>s.slice(7),undefined,prompts);
 await settings.save('fixture',{revision:0,apiKey:'fixture-only-key',model:'fixture',enabled:true,maxCalls:1,approvedUntil:Date.now()+60000,inputRate:null,outputRate:null});
 const prior=await settings.provider();await prompts.save('fixture',{revision:0,text:'修改后的测试提示词'});const next=await settings.provider(),sent:string[]=[];
 const fake:typeof fetch=async(_url,options)=>{sent.push(JSON.parse(String(options?.body)).messages[0].content);return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({text:'测试文案'})}}]}));};
 // Replace only this isolated provider's transport: no real request is issued.
 (prior as unknown as {request:typeof fetch}).request=fake;(next as unknown as {request:typeof fetch}).request=fake;
 const input=copyInput.parse({operationId:randomUUID(),bookId:'book',pageId:'page',sourceRevision:'a'.repeat(64),mode:'generate',topic:'topic'});
 await prior.generate(input,new AbortController().signal);await next.generate(input,new AbortController().signal);assert.deepEqual(sent,[DEFAULT_COPY_PROMPT,'修改后的测试提示词']);
});
