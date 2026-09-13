import {randomBytes} from 'node:crypto';
import {resolve} from 'node:path';
import {ObjectDocumentGroup,type ConditionalObjects} from './object-documents.js';
import {ObjectTemporaryMedia,type TemporaryObjects} from './temporary-media.js';
import {ObjectWorkObjects,ObjectWorkRepository} from './work-storage.js';
import {InviteAccess,configSchema} from './access.js';
import {Admin} from './admin.js';
import {CloudTasks,type TaskTransport} from './cloud-tasks.js';
import {TaskSigner,VefaasTaskTransport} from './task-http.js';
import {createApp} from './app.js';
import {publicOrigin} from './http-policy.js';
import {connectTos} from './tos-client.js';

export function cloudConfiguration(env:NodeJS.ProcessEnv){
  if(env.SHIYE_DEPLOYMENT!=='cloud-test'||env.SHIYE_STORAGE!=='tos')throw Error('此入口仅用于明确配置的 TOS 云端测试。');
  const role=env.SHIYE_APP_ROLE;if(role!=='web'&&role!=='worker')throw Error('云端应用角色必须为 web 或 worker。');
  const origin=publicOrigin(env.SHIYE_PUBLIC_ORIGIN||'');
  const port=Number(env._FAAS_RUNTIME_PORT||env.SHIYE_PORT||3000);
  if(!Number.isInteger(port)||port<1||port>65535)throw Error('云端端口配置无效。');
  const key=(name:string)=>{const v=env[name];if(!v||!/^[a-f0-9]{64}$/.test(v))throw Error('缺少独立的云端加密或任务签名密钥。');return Buffer.from(v,'hex');};
  const encryptionKey=key('SHIYE_DATA_ENCRYPTION_KEY'),taskKey=key('SHIYE_TASK_SIGNING_KEY');
  if(encryptionKey.equals(taskKey))throw Error('数据与任务签名须使用不同密钥。');
  if(!env.SHIYE_INITIAL_ADMIN_USERNAME||!env.SHIYE_INITIAL_ADMIN_PASSWORD)throw Error('缺少受控的初始管理员配置。');
  const workerUrl=env.SHIYE_WORKER_URL;if(!workerUrl)throw Error('缺少独立异步任务入口。');
  const ttl=Number(env.SHIYE_TEMP_TTL_SECONDS||3600)*1000;
  if(!Number.isInteger(ttl)||ttl<60000||ttl>86400000)throw Error('临时媒体期限无效。');
  return {role,origin,port,encryptionKey,taskKey,workerUrl,ttl,administrator:{username:env.SHIYE_INITIAL_ADMIN_USERNAME,password:env.SHIYE_INITIAL_ADMIN_PASSWORD}};
}

export async function bootstrapCloud(env:NodeJS.ProcessEnv,injected?:{objects:ConditionalObjects&TemporaryObjects;transport?:TaskTransport}){
  const config=cloudConfiguration(env),objects=injected?.objects||connectTos(env).objects;
  const mode=env.SHIYE_SEGMENTATION_MODE||'mock';
  if(!['mock','live'].includes(mode))throw Error('未知云端运行模式。');
  if(mode==='live'&&env.SHIYE_BAIDU_APPROVED!=='true')throw Error('云端真实抠图尚未授权。');
  const maxCalls=env.SHIYE_BAIDU_LIMITS_DISABLED==='true'?null:Number(env.SHIYE_BAIDU_MAX_CALLS||100);
  const keys={apiKey:env.BAIDU_API_KEY||'',secretKey:env.BAIDU_SECRET_KEY||''};
  const documents=new ObjectDocumentGroup(objects,'service/state.json');
  // Only initialize absent cells; existing accounts/configuration are never reset.
  await documents.cell('invites',v=>configSchema.parse(v)).initialize({version:1,secret:randomBytes(32).toString('hex'),invites:[],users:[],audit:[]});
  const access=new InviteAccess('/unused/invites',undefined,documents),admin=new Admin('/unused/admin',access,undefined,{documents,encryptionKey:config.encryptionKey});
  await admin.init({...keys,cutout:mode==='live'&&!!keys.apiKey&&!!keys.secretKey,naming:mode==='live'&&env.SHIYE_BAIDU_NAMING_ENABLED==='true'&&!!keys.apiKey&&!!keys.secretKey},config.administrator);
  const signer=new TaskSigner(config.taskKey),tasks=new CloudTasks(documents,s=>admin.sealProviderData(s),s=>admin.openProviderData(s),injected?.transport||new VefaasTaskTransport(config.workerUrl,signer));
  const app=await createApp({runtime:'/tmp/shiye-cloud-test',staticRoot:resolve('shiye-editorial-prototype'),publicOrigin:config.origin,mode,...(mode==='live'?{live:{provider:admin,maxCalls,approvedUntil:null},naming:admin}:{}),workStorageKind:'tos',ttl:config.ttl,admin,access,aiDocuments:documents,cloudTasks:{tasks,signer},taskStorage:{documents,media:new ObjectTemporaryMedia(objects)},workStorage:{repository:new ObjectWorkRepository(objects),objects:new ObjectWorkObjects(objects)}});
  return {...app,admin,tasks,config,serve:config.role==='worker'?app.workerApp!:app.app};
}
