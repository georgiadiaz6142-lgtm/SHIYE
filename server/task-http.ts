import express from 'express';
import { createHmac,timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { TaskTransport,CloudTasks,CloudTask } from './cloud-tasks.js';

const command=z.discriminatedUnion('kind',[
  z.object({kind:z.literal('execute'),taskId:z.string().uuid(),signature:z.string().regex(/^[a-f0-9]{64}$/)}).strict(),
  z.object({kind:z.literal('maintenance'),signature:z.string().regex(/^[a-f0-9]{64}$/)}).strict(),
]);
export class TaskSigner {
  constructor(private key:Buffer){if(key.length!==32)throw Error('任务签名密钥必须为独立的 32 字节密钥。');}
  private sign(message:string){return createHmac('sha256',this.key).update('shiye-task-v1:'+message).digest('hex');}
  execute(taskId:string){z.string().uuid().parse(taskId);return {kind:'execute' as const,taskId,signature:this.sign('execute:'+taskId)};}
  maintenance(){return {kind:'maintenance' as const,signature:this.sign('maintenance')};}
  verify(value:unknown){
    const parsed=command.safeParse(value);if(!parsed.success)return null;
    const v=parsed.data,expected=this.sign(v.kind==='execute'?'execute:'+v.taskId:'maintenance');
    return timingSafeEqual(Buffer.from(v.signature,'hex'),Buffer.from(expected,'hex'))?v:null;
  }
}

// Official Webserver async functions accept an ordinary gateway HTTP POST and
// acknowledge with 202. This URL MUST target a separately created async app.
// No redirects or generic POST retry: an uncertain reply stays in the outbox.
export class VefaasTaskTransport implements TaskTransport {
  constructor(private url:string,private signer:TaskSigner,private request:typeof fetch=fetch){
    const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash)throw Error('任务入口必须为固定 HTTPS 地址。');
  }
  async notify(taskId:string){
    const response=await this.request(this.url,{method:'POST',redirect:'error',signal:AbortSignal.timeout(4000),headers:{'Content-Type':'application/json'},body:JSON.stringify(this.signer.execute(taskId))});
    await response.body?.cancel();if(response.status!==202)throw Error('云端任务接收状态未确认。');
  }
}

// Separate worker app: it has no public site, login, upload or administration routes.
// A Timer's configured message can carry signer.maintenance(). Never log the body.
export function taskApp(tasks:CloudTasks,signer:TaskSigner,run:(task:CloudTask)=>Promise<void>,cleanup:()=>Promise<void>){
  const app=express();app.disable('x-powered-by');
  app.use((_req,res,next)=>{res.setHeader('Cache-Control','no-store');next();});
  app.post('/',express.json({limit:'2kb',strict:true,inflate:false}),async(req,res)=>{
    const value=signer.verify(req.body);if(!value){res.sendStatus(403);return;}
    if(value.kind==='execute')await tasks.execute(value.taskId,run);
    else{
      const results=await Promise.allSettled([cleanup(),tasks.maintain()]);
      if(results.some(r=>r.status==='rejected'))throw Error('定时维护未完成。');
    }
    res.sendStatus(204); // only AFTER all work has completed
  });
  app.use((_req,res)=>res.sendStatus(404));
  app.use((_error:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{res.sendStatus(503);});
  return app;
}
