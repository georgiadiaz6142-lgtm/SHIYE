import {TosClient} from '@volcengine/tos-sdk';
import {TosObjects} from './tos-objects.js';

export function tosClientOptions(env:NodeJS.ProcessEnv){
  const region=env.SHIYE_TOS_REGION||'cn-beijing';
  if(region!=='cn-beijing')throw Error('本次部署仅接入北京 TOS。');
  const endpoint=env.SHIYE_TOS_ENDPOINT||'tos-cn-beijing.volces.com';
  if(!['tos-cn-beijing.volces.com','tos-cn-beijing.ivolces.com'].includes(endpoint))throw Error('TOS 地址必须为北京官方端点。');
  const accessKeyId=env.SHIYE_TOS_ACCESS_KEY_ID,accessKeySecret=env.SHIYE_TOS_SECRET_ACCESS_KEY;
  if(!accessKeyId?.trim()||!accessKeySecret?.trim())throw Error('尚未配置拾页专用 TOS 访问权限。');
  return {region,endpoint,accessKeyId,accessKeySecret,...(env.SHIYE_TOS_SECURITY_TOKEN?{stsToken:env.SHIYE_TOS_SECURITY_TOKEN}:{}),
    secure:true,enableVerifySSL:true,maxRetryCount:0,connectionTimeout:3000,requestTimeout:8000,maxConnections:16};
}
export function connectTos(env:NodeJS.ProcessEnv){
  const bucket=env.SHIYE_TOS_BUCKET,prefix=env.SHIYE_TOS_PREFIX||'shiye/';
  if(!bucket)throw Error('尚未配置拾页私有存储桶。');
  const client=new TosClient(tosClientOptions(env));
  return {client,objects:new TosObjects(client,bucket,prefix),bucket,prefix};
}
