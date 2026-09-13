import test from 'node:test';
import assert from 'node:assert/strict';
import {request} from 'node:http';
import {randomBytes,randomUUID} from 'node:crypto';
import {TosClient} from '@volcengine/tos-sdk';
import {tosClientOptions} from '../tos-client.js';
import {TosObjects} from '../tos-objects.js';
import {bootstrapCloud,cloudConfiguration} from '../cloud-bootstrap.js';
import type {TemporaryObjects} from '../temporary-media.js';

const env={SHIYE_TOS_ACCESS_KEY_ID:'synthetic',SHIYE_TOS_SECRET_ACCESS_KEY:'synthetic'};
test('official TOS SDK emits conditional headers and never retries an uncertain write',async()=>{
 let calls=0,headers:Record<string,unknown>={};
 const client=new TosClient(tosClientOptions(env));
 client.opts.requestAdapter=async config=>{calls++;headers=config.headers as Record<string,unknown>;throw Object.assign(Error('synthetic timeout'),{code:'ETIMEDOUT',config});};
 const objects=new TosObjects(client,'synthetic-bucket');
 await assert.rejects(objects.put('test.json',Buffer.from('synthetic'),null),{errorType:'STORAGE_WRITE_UNCONFIRMED'});
 assert.equal(calls,1);assert.equal(headers['if-none-match'],'*');assert.ok(headers['content-md5']);
 assert.equal(client.opts.maxRetryCount,0);assert.equal(client.opts.secure,true);assert.equal(client.opts.enableVerifySSL,true);
 assert.throws(()=>tosClientOptions({...env,SHIYE_TOS_ENDPOINT:'evil.example'}));assert.throws(()=>tosClientOptions({}));
});
class Objects implements TemporaryObjects{
 rows=new Map<string,{bytes:Buffer;etag:string}>();async get(k:string){return this.rows.get(k)||null;}
 async put(k:string,b:Buffer,e:string|null){if((this.rows.get(k)?.etag??null)!==e)return false;this.rows.set(k,{bytes:Buffer.from(b),etag:randomUUID()});return true;}
 async removeTemporary(k:string){this.rows.delete(k);}
}
test('cloud bootstrap reconnects to existing identity, disables AI by default and never falls back to local files',async()=>{
 const e={SHIYE_DEPLOYMENT:'cloud-test',SHIYE_STORAGE:'tos',SHIYE_APP_ROLE:'web',SHIYE_PUBLIC_ORIGIN:'https://shiye.example.test',SHIYE_WORKER_URL:'https://worker.example.test',SHIYE_INITIAL_ADMIN_USERNAME:'测试管理员',SHIYE_INITIAL_ADMIN_PASSWORD:'Synthetic-password-123!',SHIYE_DATA_ENCRYPTION_KEY:randomBytes(32).toString('hex'),SHIYE_TASK_SIGNING_KEY:randomBytes(32).toString('hex')};
 const objects=new Objects(),transport={notify:async()=>{}};
 const a=await bootstrapCloud(e,{objects,transport});const token=await a.admin.login(e.SHIYE_INITIAL_ADMIN_USERNAME,e.SHIYE_INITIAL_ADMIN_PASSWORD,'fixture');
 const b=await bootstrapCloud({...e,SHIYE_APP_ROLE:'worker',SHIYE_INITIAL_ADMIN_USERNAME:'新名字'},{objects,transport});
 assert.equal((await b.admin.resolveSession(token))?.username,e.SHIYE_INITIAL_ADMIN_USERNAME);assert.equal(b.serve,b.workerApp);assert.equal(a.serve,a.app);
 const server=a.app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 try{const response=await new Promise<{status:number;body:string;storage:unknown}>((resolve,reject)=>{const req=request({hostname:'127.0.0.1',port:(server.address() as {port:number}).port,path:'/api/works/status',headers:{host:'shiye.example.test',cookie:'shiye_admin='+token+'; shiye_session='+randomBytes(32).toString('hex')}},res=>{let body='';res.setEncoding('utf8');res.on('data',chunk=>body+=chunk);res.on('end',()=>resolve({status:res.statusCode!,body,storage:res.headers['x-shiye-work-storage']}));});req.on('error',reject);req.end();});assert.equal(response.status,200,response.body);assert.deepEqual(JSON.parse(response.body),{storage:'tos',cloudConnected:true});assert.equal(response.storage,'tos');}
 finally{await new Promise<void>(r=>server.close(()=>r()));}
 assert.equal(await b.admin.apiEnabled('cutout'),false);assert.equal((await b.copy!.status({owner:'fixture'})).enabled,false);
 assert.throws(()=>cloudConfiguration({...e,SHIYE_DEPLOYMENT:'production'}));assert.throws(()=>cloudConfiguration({...e,SHIYE_TASK_SIGNING_KEY:e.SHIYE_DATA_ENCRYPTION_KEY}));
 await assert.rejects(bootstrapCloud({...e,SHIYE_DATA_ENCRYPTION_KEY:randomBytes(32).toString('hex')},{objects,transport}));
 assert.ok(objects.rows.has('service/state.json'));assert.ok(!objects.rows.get('service/state.json')!.bytes.toString().includes(e.SHIYE_INITIAL_ADMIN_PASSWORD));
});

test('cloud live mode requires explicit approval and a bounded provider budget',async()=>{
 const e={SHIYE_DEPLOYMENT:'cloud-test',SHIYE_STORAGE:'tos',SHIYE_APP_ROLE:'web',SHIYE_SEGMENTATION_MODE:'live',SHIYE_PUBLIC_ORIGIN:'https://shiye.example.test',SHIYE_WORKER_URL:'https://worker.example.test',SHIYE_INITIAL_ADMIN_USERNAME:'测试管理员',SHIYE_INITIAL_ADMIN_PASSWORD:'Synthetic-password-123!',SHIYE_DATA_ENCRYPTION_KEY:randomBytes(32).toString('hex'),SHIYE_TASK_SIGNING_KEY:randomBytes(32).toString('hex'),SHIYE_BAIDU_MAX_CALLS:'2'};
 const objects=new Objects(),transport={notify:async()=>{}};
 await assert.rejects(bootstrapCloud(e,{objects,transport}),/尚未授权/);assert.equal(objects.rows.size,0);
 const a=await bootstrapCloud({...e,SHIYE_BAIDU_APPROVED:'true'},{objects,transport});
 assert.doesNotThrow(()=>a.jobs.assertLive());assert.equal(await a.admin.apiEnabled('cutout'),false);
 await assert.rejects(bootstrapCloud({...e,SHIYE_BAIDU_APPROVED:'true',SHIYE_BAIDU_MAX_CALLS:'invalid'},{objects:new Objects(),transport}));
});
