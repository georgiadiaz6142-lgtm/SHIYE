import {tosCheckApp} from './tos-check-app.js';
try{
  const port=Number(process.env._FAAS_RUNTIME_PORT||3000);
  if(!Number.isInteger(port)||port<1||port>65535)throw Error('port');
  const server=tosCheckApp(process.env).listen(port,'0.0.0.0');
  server.on('error',()=>{console.error('存储验证监听失败。');process.exitCode=1;});
  const stop=()=>server.close(()=>process.exit(0));process.once('SIGINT',stop);process.once('SIGTERM',stop);
}catch{console.error('存储验证配置无效。');process.exitCode=1;}
