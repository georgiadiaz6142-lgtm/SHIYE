import express from 'express';
import {bootstrapCloud,cloudConfiguration} from './cloud-bootstrap.js';
import {VefaasTosScope} from './vefaas-credentials.js';

export function cloudRoleApp(env:NodeJS.ProcessEnv,objects=new VefaasTosScope(env),bootstrap=bootstrapCloud){
  const config=cloudConfiguration(env);
  if(env.SHIYE_TOS_AUTH!=='vefaas-role')throw Error('未启用函数执行角色。');
  const app=express();app.disable('x-powered-by');
  let ready:ReturnType<typeof bootstrap>|undefined;
  // STS headers are only available once a platform request arrives. Initialize
  // once under that request, then resolve storage credentials per request.
  app.use(async(req,res)=>{
    try{
      await objects.run(req.headers,async()=>{
        if(!ready)ready=bootstrap(env,{objects}).catch(error=>{ready=undefined;throw error;});
        const service=await ready;
        service.serve(req,res);
      });
    }catch{
      if(!res.headersSent)res.status(503).json({error:{type:'CLOUD_STORAGE_UNAVAILABLE',message:'云端存储暂时不可用，请稍后重试。'}});
    }
  });
  return {serve:app,config};
}
