import test from 'node:test';
import assert from 'node:assert/strict';
import {VefaasTosScope,vefaasCredentialEnv} from '../vefaas-credentials.js';
import express from 'express';
import {randomBytes,randomUUID} from 'node:crypto';
import type {AddressInfo} from 'node:net';
import {cloudRoleApp} from '../cloud-role-app.js';
import type {bootstrapCloud} from '../cloud-bootstrap.js';
import {tosCheckApp} from '../tos-check-app.js';

const headers=(id:string)=>({'x-faas-access-key-id':id,'x-faas-secret-access-key':'synthetic-secret','x-faas-session-token':'synthetic-token'});
test('platform credentials fail closed and require a complete unambiguous STS triplet',()=>{
  assert.throws(()=>vefaasCredentialEnv({}));
  assert.throws(()=>vefaasCredentialEnv({...headers('one'),'x-faas-session-token':undefined}));
  assert.throws(()=>vefaasCredentialEnv({...headers('one'),'x-faas-access-key-id':['one','two']}));
  assert.throws(()=>vefaasCredentialEnv({...headers('one'),'x-faas-access-key-id':'one\r\n'}));
  assert.equal(vefaasCredentialEnv(headers('one')).SHIYE_TOS_ACCESS_KEY_ID,'one');
});
test('concurrent platform requests use their own credentials and later requests obtain fresh credentials',async()=>{
  const seen:string[]=[],base={SHIYE_TOS_BUCKET:'synthetic-bucket'};
  const scope=new VefaasTosScope(base,env=>({
    get:async()=>{await Promise.resolve();seen.push(env.SHIYE_TOS_ACCESS_KEY_ID!);return {bytes:Buffer.from(env.SHIYE_TOS_ACCESS_KEY_ID!),etag:'fixture'};},
    put:async()=>true,removeTemporary:async()=>{},
  }));
  let release!:()=>void;const gate=new Promise<void>(r=>release=r);
  const first=scope.run(headers('first'),async()=>{await gate;return scope.get('fixture');});
  const second=scope.run(headers('second'),async()=>{const value=await scope.get('fixture');release();return value;});
  const result=await Promise.all([first,second]);
  assert.deepEqual(result.map(v=>v?.bytes.toString()),['first','second']);
  assert.equal((await scope.run(headers('rotated'),()=>scope.get('fixture')))?.bytes.toString(),'rotated');
  await assert.rejects(scope.get('fixture'));
  assert.deepEqual(seen,['second','first','rotated']);assert.deepEqual(base,{SHIYE_TOS_BUCKET:'synthetic-bucket'});
});
test('role HTTP entry rejects missing credentials, retries failed initialization, and preserves request scope after shared initialization',async()=>{
  const env={SHIYE_DEPLOYMENT:'cloud-test',SHIYE_STORAGE:'tos',SHIYE_TOS_AUTH:'vefaas-role',SHIYE_APP_ROLE:'web',SHIYE_PUBLIC_ORIGIN:'https://shiye.example.test',SHIYE_WORKER_URL:'https://worker.example.test',SHIYE_INITIAL_ADMIN_USERNAME:'fixture',SHIYE_INITIAL_ADMIN_PASSWORD:'Synthetic-password-123!',SHIYE_DATA_ENCRYPTION_KEY:randomBytes(32).toString('hex'),SHIYE_TASK_SIGNING_KEY:randomBytes(32).toString('hex')};
  const scope=new VefaasTosScope(env,e=>({get:async()=>({bytes:Buffer.from(e.SHIYE_TOS_ACCESS_KEY_ID!),etag:'fixture'}),put:async()=>true,removeTemporary:async()=>{}}));
  let initializations=0;
  const bootstrap=(async()=>{
    initializations++;if(initializations===1)throw Error('synthetic sensitive failure');
    const serve=express();serve.get('/',async(_req,res)=>{await new Promise(r=>setImmediate(r));res.json({identity:(await scope.get('fixture'))?.bytes.toString()});});
    return {serve};
  }) as unknown as typeof bootstrapCloud;
  const {serve}=cloudRoleApp(env,scope,bootstrap);
  const server=serve.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
  const url=`http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
  try{
    assert.equal((await fetch(url)).status,503);assert.equal(initializations,0);
    const failed=await fetch(url,{headers:headers('first')});assert.equal(failed.status,503);assert.ok(!(await failed.text()).includes('sensitive'));
    const responses=await Promise.all(['second','third'].map(async value=>{const r=await fetch(url,{headers:headers(value)});assert.equal(r.status,200);return (await r.json() as {identity:string}).identity;}));
    assert.deepEqual(responses,['second','third']);assert.equal(initializations,2);
    assert.equal((await fetch(url)).status,503);assert.equal(initializations,2);
    assert.equal((await (await fetch(url,{headers:headers('fresh')})).json() as {identity:string}).identity,'fresh');
  }finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
});
test('storage check requires a secret, unexpired window and platform credentials, then returns the same result without repeat execution',async()=>{
  const token=randomBytes(32).toString('hex'),env={SHIYE_DEPLOYMENT:'storage-verify',SHIYE_STORAGE_VERIFY_TOKEN:token,SHIYE_STORAGE_VERIFY_UNTIL:String(Date.now()+60000)};
  let calls=0;const app=tosCheckApp(env,async e=>{calls++;assert.equal(e.SHIYE_TOS_ACCESS_KEY_ID,'fixture');return {runId:randomUUID(),prefix:'synthetic/',checks:[],realTos:true};});
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const url=`http://127.0.0.1:${(server.address() as AddressInfo).port}/_storage-verify`;
  try{
    assert.equal((await fetch(url,{method:'POST'})).status,403);
    assert.equal((await fetch(url,{method:'POST',headers:{authorization:'Bearer '+token}})).status,503);assert.equal(calls,0);
    const h={...headers('fixture'),authorization:'Bearer '+token};assert.equal((await fetch(url,{method:'POST',headers:h})).status,200);assert.equal(calls,1);
    assert.equal((await fetch(url,{method:'POST',headers:h})).status,200);assert.equal(calls,1);
    assert.equal((await (await fetch(url,{headers:h})).json() as {status:string}).status,'passed');assert.equal(calls,1);
    assert.throws(()=>tosCheckApp({...env,SHIYE_DEPLOYMENT:'production'}));
  }finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
});

test('storage verification failure is cached, redacted, and concurrent calls execute once',async()=>{
  const token=randomBytes(32).toString('hex');let calls=0;
  const app=tosCheckApp({SHIYE_DEPLOYMENT:'storage-verify',SHIYE_STORAGE_VERIFY_TOKEN:token,SHIYE_STORAGE_VERIFY_UNTIL:String(Date.now()+60000)},async()=>{calls++;await new Promise(r=>setTimeout(r,20));throw Error('sensitive SDK details');});
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const url=`http://127.0.0.1:${(server.address() as AddressInfo).port}/_storage-verify`;
  const h={...headers('fixture'),authorization:'Bearer '+token};
  try{
    assert.deepEqual(await (await fetch(url,{headers:h})).json(),{status:'not-started'});
    const results=await Promise.all([1,2].map(async()=>await (await fetch(url,{method:'POST',headers:h})).json()));
    assert.deepEqual(results,[{status:'failed',stage:'initialization'},{status:'failed',stage:'initialization'}]);assert.equal(calls,1);
    assert.deepEqual(await (await fetch(url,{headers:h})).json(),results[0]);assert.equal(calls,1);
    assert.equal((await fetch(url,{headers:{authorization:'Bearer '+String.fromCharCode(233).repeat(64)}})).status,403);
  }finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
});
