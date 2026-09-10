import { resolve } from 'node:path';
import { mkdir, open, readFile, unlink } from 'node:fs/promises';
import { BaiduProvider } from './baidu.js';
import { createApp } from './app.js';
import { Admin } from './admin.js';
import { InviteAccess } from './access.js';

const host=process.env.SHIYE_HOST||'127.0.0.1';
if(host!=='127.0.0.1')throw new Error('本阶段仅允许回环监听。');
const port=Number(process.env.SHIYE_PORT||4176), ttl=Number(process.env.SHIYE_TEMP_TTL_SECONDS||3600);
if(!Number.isInteger(port)||port<1||port>65535||!Number.isInteger(ttl)||ttl<60||ttl>86400)throw new Error('端口或模拟临时文件有效期配置无效。');
const mode=process.env.SHIYE_SEGMENTATION_MODE||'mock';
let live:import('./baidu.js').LiveOptions|undefined;
if(mode==='live'){
  const limitsDisabled=process.env.SHIYE_BAIDU_LIMITS_DISABLED==='true';
  const maxCalls=limitsDisabled?null:Number(process.env.SHIYE_BAIDU_MAX_CALLS),approvedUntil=limitsDisabled?null:Date.parse(process.env.SHIYE_BAIDU_APPROVED_UNTIL||'');
  if(process.env.SHIYE_BAIDU_APPROVED!=='true'||!process.env.SHIYE_TEMP_TTL_SECONDS||!process.env.BAIDU_API_KEY?.trim()||!process.env.BAIDU_SECRET_KEY?.trim())throw new Error('真实测试尚未获准或配置不完整；保持模拟模式直到额度、照片和保留期限确认。');
  live={provider:new BaiduProvider(process.env.BAIDU_API_KEY,process.env.BAIDU_SECRET_KEY),maxCalls,approvedUntil};
}
const runtime=resolve(process.env.SHIYE_RUNTIME_DIR||'.local/shiye');
await mkdir(runtime,{recursive:true,mode:0o700});
const lockPath=resolve(runtime,'process.lock');
async function lock() {
  try {const f=await open(lockPath,'wx',0o600);await f.writeFile(String(process.pid));await f.close();}
  catch(e){
    if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;
    const pid=Number(await readFile(lockPath,'utf8'));
    if(!Number.isInteger(pid)||pid<1)throw new Error('锁文件无效，请先检查运行目录。');
    try {process.kill(pid,0);}catch(err){if((err as NodeJS.ErrnoException).code==='ESRCH'){await unlink(lockPath);return lock();}throw err;}
    throw new Error('该运行目录已有进程使用，不能启动第二个写入者。');
  }
}
await lock();
try {
  const access=new InviteAccess(resolve(runtime,'invites.json')),admin=new Admin(resolve(runtime,'admin.json'),access);
  await admin.init({apiKey:process.env.BAIDU_API_KEY||'',secretKey:process.env.BAIDU_SECRET_KEY||'',cutout:mode==='live',naming:process.env.SHIYE_BAIDU_NAMING_ENABLED==='true'},resolve('.local/admin-account.txt'));
  if(live)live.provider=admin;
  const {app,jobs,copy}=await createApp({admin,access,runtime,staticRoot:resolve('shiye-editorial-prototype'),ttl:ttl*1000,mode,live,naming:mode==='live'?admin:undefined});
  const server=app.listen(port,host,()=>console.log(`拾页本机服务 http://${host}:${port}；${mode==='live'?'百度抠图，仅处理主动点击上传的照片。':'模拟模式，无外部模型调用。'}`));
  server.on('error',async e=>{console.error(e instanceof Error?e.message:'服务启动失败');await unlink(lockPath);process.exitCode=1;});
  const timer=setInterval(()=>jobs.expire().catch(()=>console.error('临时测试数据清理失败。')),60_000);timer.unref();
  let closing=false;
  const stop=()=>{if(closing)return;closing=true;clearInterval(timer);server.close(async()=>{await jobs.idle();await copy?.idle();await unlink(lockPath);process.exit(0);});};
  process.on('SIGINT',stop);process.on('SIGTERM',stop);
}catch(e){await unlink(lockPath);throw e;}
