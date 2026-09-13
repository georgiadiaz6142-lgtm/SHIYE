const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const code=fs.readFileSync('shiye-editorial-prototype/api-client.js','utf8');
function client(fetch){
 const context=vm.createContext({fetch,Response,AbortController,setTimeout,clearTimeout});
 vm.runInContext(code,context);return context.ShiyeAPI;
}
test('server error preserves status, safe message, request ID and task code',async()=>{
 const api=client(async()=>Response.json({requestId:'request-1',error:{errorType:'PROVIDER_TIMEOUT',message:'供应商超时',retryable:false}},{status:504}));
 await assert.rejects(api.json('/api/jobs/job-1'),e=>e.status===504&&e.code==='PROVIDER_TIMEOUT'&&e.errorType===e.code&&e.requestId==='request-1'&&e.message==='供应商超时'&&!e.retryable);
});
test('HTML gateway errors do not expose gateway content or raw JSON exceptions',async()=>{
 const api=client(async()=>new Response('<html>private gateway details</html>',{status:502}));
 await assert.rejects(api.json('/api/account'),e=>e.code==='INVALID_RESPONSE'&&!e.message.includes('private'));
});
test('expired authentication is returned to the feature without clearing local work or redirecting',async()=>{
 const api=client(async()=>Response.json({}, {status:401}));
 await assert.rejects(api.json('/api/account'),e=>e.status===401&&e.message.includes('登录'));
});
test('timed-out mutation makes one attempt and reports an unknown outcome',async()=>{
 let calls=0;const api=client((url,{signal})=>new Promise((resolve,reject)=>{calls++;signal.addEventListener('abort',()=>reject(Error('aborted')));}));
 await assert.rejects(api.json('/api/segmentation/jobs',{method:'POST',body:'{}',timeoutMs:10}),e=>e.code==='REQUEST_TIMEOUT'&&e.outcomeUnknown&&!e.retryable);
 assert.equal(calls,1);
});
test('caller cancellation stays distinct from timeout and sends no retry',async()=>{
 const controller=new AbortController();let calls=0;
 const api=client((url,{signal})=>new Promise((resolve,reject)=>{calls++;signal.addEventListener('abort',()=>reject(Error('aborted')));}));
 const task=api.json('/api/ai/copy/jobs',{method:'POST',signal:controller.signal});controller.abort();
 await assert.rejects(task,e=>e.code==='REQUEST_CANCELLED'&&e.outcomeUnknown);assert.equal(calls,1);
});
test('connection failures on writes never claim that nothing was submitted',async()=>{
 const api=client(async()=>{throw Error('socket closed')});
 await assert.rejects(api.json('/api/account/register',{method:'POST'}),e=>e.code==='LOCAL_CONNECTION_FAILED'&&e.outcomeUnknown);
});
test('same-origin cookies and identity headers survive normalization; binary data stays binary',async()=>{
 let options;const api=client(async(url,init)=>{options=init;return new Response(new Uint8Array([0,1,255]));});
 const response=await api.response('/api/works/images/example',{headers:{'X-Shiye-Work-Account':'account-a'}});
 assert.deepEqual([...new Uint8Array(await response.arrayBuffer())],[0,1,255]);
 assert.equal(options.credentials,'same-origin');assert.equal(options.headers['X-Shiye-Work-Account'],'account-a');
});
test('non-API and external paths are rejected without transmission',async()=>{
 let calls=0;const api=client(async()=>{calls++;return Response.json({});});
 for(const path of ['https://example.com/api/x','//example.com/api/x','/assets/x','/api/\\example.com'])await assert.rejects(api.json(path),e=>e.code==='INVALID_REQUEST');
 assert.equal(calls,0);
});
