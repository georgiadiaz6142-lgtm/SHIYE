import express from 'express';
import {timingSafeEqual} from 'node:crypto';
import {verifyTos,StorageVerificationFailure} from './tos-smoke.js';
import {vefaasCredentialEnv} from './vefaas-credentials.js';

// Temporary deployment check, not the product server. No accounts or user data.
export function tosCheckApp(env:NodeJS.ProcessEnv,verify=verifyTos){
  const token=env.SHIYE_STORAGE_VERIFY_TOKEN,until=Number(env.SHIYE_STORAGE_VERIFY_UNTIL);
  if(env.SHIYE_DEPLOYMENT!=='storage-verify'||!token||!/^[a-f0-9]{64}$/.test(token)||!Number.isSafeInteger(until))throw Error('存储验证入口未配置。');
  const app=express();app.disable('x-powered-by');let result:Promise<unknown>|undefined;
  app.get('/healthz',(_req,res)=>res.json({status:'ok',purpose:'storage-verification',node:process.versions.node}));
  app.all('/_storage-verify',async(req,res)=>{
    res.setHeader('Cache-Control','no-store');
    const input=req.header('authorization');
    if(Date.now()>until||!input||!/^Bearer [a-f0-9]{64}$/.test(input)||!timingSafeEqual(Buffer.from(input),Buffer.from('Bearer '+token))){res.sendStatus(403);return;}
    if(req.method!=='GET'&&req.method!=='POST'){res.sendStatus(405);return;}
    if(!result&&req.method==='GET'){res.json({status:'not-started'});return;}
    if(!result){
      try{
        const credentials=vefaasCredentialEnv(req.headers);
        result=Promise.resolve().then(()=>verify({...env,...credentials,SHIYE_TOS_VERIFY:'true'})).then(value=>({status:'passed',...value}),error=>({status:'failed',...(error instanceof StorageVerificationFailure?error.details:{stage:'initialization'})}));
      }catch{res.status(503).json({error:'Platform credentials unavailable.'});return;}
    }
    res.json(await result);
  });
  app.use((_req,res)=>res.sendStatus(404));return app;
}
