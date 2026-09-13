import {bootstrapCloud} from './cloud-bootstrap.js';
import {cloudRoleApp} from './cloud-role-app.js';

try{
  const {serve,config}=process.env.SHIYE_TOS_AUTH==='vefaas-role'?cloudRoleApp(process.env):await bootstrapCloud(process.env);
  const server=serve.listen(config.port,'0.0.0.0',()=>console.log(`拾页 ${config.role} 云端测试服务已启动。`));
  server.on('error',()=>{console.error('云端监听失败。');process.exitCode=1;});
  const stop=()=>server.close(()=>process.exit(0));
  process.once('SIGINT',stop);process.once('SIGTERM',stop);
}catch{
  console.error('云端初始化失败。请检查受控配置、TOS 权限和已有数据；未启用本机存储回退。');process.exitCode=1;
}
