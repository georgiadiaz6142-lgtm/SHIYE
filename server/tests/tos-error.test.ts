import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {TosServerError} from '@volcengine/tos-sdk';
import {tosErrorInfo} from '../tos-error.js';
import {TosObjects} from '../tos-objects.js';

function sdkError(status:number,body:string){
  return new TosServerError({status,data:Readable.from([body]),headers:{'x-tos-request-id':'synthetic'}} as unknown as ConstructorParameters<typeof TosServerError>[0]);
}
test('Node SDK streamed NoSuchKey is recognized and can be inspected twice',async()=>{
  const error=sdkError(404,JSON.stringify({Code:'NoSuchKey',Message:'sensitive details'}));
  assert.equal(error.code,undefined);
  const info=await tosErrorInfo(error);assert.deepEqual(info,{statusCode:404,code:'NoSuchKey'});
  const objects=new TosObjects({getObjectV2:async()=>{throw error;},putObject:async()=>{}},'shiye-test');
  assert.equal(await objects.get('missing'),null);assert.equal(await tosErrorInfo(error),info);
});
test('streamed condition failure is definite, other 404 errors never mean missing object',async()=>{
  let error=sdkError(412,'{"Code":"PreconditionFailed"}');
  const objects=new TosObjects({getObjectV2:async()=>{throw error;},putObject:async()=>{throw error;}},'shiye-test');
  assert.equal(await objects.put('state',Buffer.from('x'),'etag'),false);
  error=sdkError(412,'{"Code":"ConditionNotMet"}');assert.equal(await objects.put('state',Buffer.from('x'),null),false);
  error=sdkError(412,'{"Code":"UnknownCondition"}');await assert.rejects(objects.put('state',Buffer.from('x'),null));
  for(const code of ['NoSuchBucket','AccessDenied']){error=sdkError(404,JSON.stringify({Code:code}));await assert.rejects(objects.get('missing'));}
});
test('malformed or oversized error bodies remain unknown and never leak data',async()=>{
  for(const body of ['invalid sensitive body',JSON.stringify({Code:'NoSuchKey',extra:'x'.repeat(17000)}),'{"Code":"unsafe code"}'])assert.deepEqual(await tosErrorInfo(sdkError(404,body)),{statusCode:404});
});
