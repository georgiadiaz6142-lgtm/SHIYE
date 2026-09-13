import {randomUUID} from 'node:crypto';
import {connectTos} from './tos-client.js';
import {ObjectDocumentGroup} from './object-documents.js';
import {TosObjects} from './tos-objects.js';
import {tosErrorInfo} from './tos-error.js';

export class StorageVerificationFailure extends Error {
  constructor(readonly details:{runId:string;prefix:string;stage:string;checks:string[];sdkCode?:string;httpStatus?:number}){super('Storage verification failed');}
}

// Explicit opt-in; only new synthetic objects in a unique verification prefix.
// No bucket listing, account migration, user images, credentials or raw SDK errors.
export async function verifyTos(env:NodeJS.ProcessEnv){
  if(env.SHIYE_TOS_VERIFY!=='true')throw Error('真实 TOS 验证尚未启用。');
  const runId=randomUUID(),prefix=`shiye-verification/${runId}/`;
  const {client,bucket}=connectTos({...env,SHIYE_TOS_PREFIX:prefix});
  const key='condition.json',stateKey='restart.json',checks:string[]=[];
  let stage='empty-path',sdkCode:string|undefined,httpStatus:number|undefined;
  const inspect=async<T>(run:()=>Promise<T>)=>{sdkCode=undefined;httpStatus=undefined;try{return await run();}catch(error){const e=await tosErrorInfo(error);sdkCode=e.code;httpStatus=e.statusCode;throw error;}};
  const objects=new TosObjects({getObjectV2:i=>inspect(()=>client.getObjectV2(i)),putObject:i=>inspect(()=>client.putObject(i))},bucket,prefix);
  try {
  if(await objects.get(key)!==null)throw Error('测试路径不是空路径，已停止。');
  stage='first-create';
  if(!await objects.put(key,Buffer.from('first'),null))throw Error('首次写入未成功。');
  stage='reject-duplicate-create';
  if(await objects.put(key,Buffer.from('overwrite'),null))throw Error('TOS 未拒绝重复创建，不能上线。');
  stage='read-created';
  const first=await objects.get(key);if(first?.bytes.toString()!=='first')throw Error('读取校验失败。');
  checks.push('create-only');
  stage='concurrent-cas';
  const winners=await Promise.all([objects.put(key,Buffer.from('winner-a'),first.etag),objects.put(key,Buffer.from('winner-b'),first.etag)]);
  if(winners.filter(Boolean).length!==1)throw Error('条件并发写入不符合要求，不能上线。');
  checks.push('single-writer-cas');
  stage='persist-state';
  const group=new ObjectDocumentGroup(objects,stateKey),cell=group.cell('fixture',v=>{const x=v as {count:number};if(!Number.isInteger(x?.count))throw Error('invalid');return x;});
  await cell.initialize({count:0});await cell.update(s=>s.count++);
  stage='new-client-recovery';
  const restored=connectTos({...env,SHIYE_TOS_PREFIX:prefix});
  const recovered=await new ObjectDocumentGroup(restored.objects,stateKey).cell('fixture',v=>v as {count:number}).read();
  if(recovered.count!==1)throw Error('新连接读取持久数据失败。');checks.push('new-client-recovery');
  // Exact IDs created above only; failures leave the prefix for inspection.
  stage='cleanup';
  for(const name of [key,stateKey])await inspect(()=>client.deleteObject({bucket,key:prefix+name}));
  if(await objects.get(key)!==null||await objects.get(stateKey)!==null)throw Error('测试对象删除未确认。');
  checks.push('cleanup');return {runId,prefix,checks,realTos:true};
  }catch{throw new StorageVerificationFailure({runId,prefix,stage,checks,...(sdkCode?{sdkCode}:{}),...(httpStatus?{httpStatus}:{})});}
}

if(process.argv[1]?.endsWith('/tos-smoke.js')){
  try{console.log(JSON.stringify(await verifyTos(process.env)));}
  catch{console.error('TOS 实测未通过；未改动用户数据。请检查专用桶权限、端点或条件写入响应。');process.exitCode=1;}
}
