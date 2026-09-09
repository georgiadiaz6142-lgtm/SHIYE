import express from 'express';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { resolve, relative, sep } from 'node:path';
import { ZodError } from 'zod';
import { Fault, initUpload, startJob, refineJob, id } from '../shared/contracts.js';
import { Store } from './store.js';
import { type LiveOptions } from './baidu.js';
import { Jobs } from './jobs.js';

export async function createApp(options:{runtime:string;staticRoot:string;ttl?:number;latency?:number;mode?:string;live?:LiveOptions}) {
  const runtime=resolve(options.runtime), staticRoot=resolve(options.staticRoot);
  if(runtime===staticRoot||!relative(staticRoot,runtime).startsWith('..'+sep))
    throw new Error('运行目录必须位于静态目录之外。');
  const live=options.mode==='live';
  if(options.mode&&!['mock','live'].includes(options.mode))throw new Error('未知运行模式。');
  if(live&&(!options.live||options.live.maxCalls!==null&&(!Number.isInteger(options.live.maxCalls)||options.live.maxCalls<1||options.live.maxCalls>100)||options.live.approvedUntil!==null&&(!Number.isFinite(options.live.approvedUntil)||options.live.approvedUntil<=Date.now())||!options.ttl))throw new Error('缺少明确的测试上限、授权期限或本地保留期限，不启用 live 模式。');
  if(!live&&options.live)throw new Error('模拟模式不能装载真实供应商。');
  const store=new Store(runtime);await store.init();
  const jobs=new Jobs(store,options.ttl??3_600_000,options.latency,options.live);await jobs.recover();
  const app=express();app.disable('x-powered-by');
  app.use((req,res,next)=>{
    const origin=`http://127.0.0.1:${req.socket.localPort}`;
    if(req.headers.host!==new URL(origin).host||req.headers.origin&&req.headers.origin!==origin||req.headers['sec-fetch-site']==='cross-site'){
      res.status(403).json({error:{errorType:'ORIGIN_DENIED',message:'仅允许从本机拾页页面访问。',retryable:false}});return;
    }
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    if(req.path.startsWith('/api/')){
      res.setHeader('Cache-Control','no-store');
      if(!['GET','HEAD'].includes(req.method)&&req.headers.origin!==origin) {res.status(403).json({error:{errorType:'ORIGIN_DENIED',message:'请求来源无效。',retryable:false}});return;}
    }
    next();
  });
  app.get('/api/health',(_req,res)=>res.json({status:'ok',limitsDisabled:live&&options.live!.maxCalls===null&&options.live!.approvedUntil===null,mode:live?'live':'mock',provider:live?'baidu':'mock',liveAvailable:live&&(options.live!.approvedUntil===null||options.live!.approvedUntil>Date.now()),photosAccepted:live&&(options.live!.approvedUntil===null||options.live!.approvedUntil>Date.now()),mock:!live,capabilities:{automaticSeparateObjects:false,box:live,points:!live},...(live?{localTtlSeconds:options.ttl!/1000}:{} )}));
  app.use('/api',(req,res,next)=>{
    let token=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('shiye_session='))?.slice(14);
    if(!token||!/^[a-f0-9]{64}$/.test(token)){
      if(req.method!=='GET'||req.path!=='/session'){next(new Fault(401,'SESSION_REQUIRED','请重新打开工坊。'));return;}
      token=randomBytes(32).toString('hex');res.cookie('shiye_session',token,{httpOnly:true,sameSite:'strict',path:'/api',maxAge:7*24*3600*1000});
    }
    res.locals.owner=createHash('sha256').update(token).digest('hex');res.locals.requestId=randomUUID();next();
  });
  // The explicit upload button submits the chosen file; same-origin and session gates precede parsing.
  app.post('/api/uploads/photo',(req,_res,next)=>{
    try{jobs.assertLive();next();}catch(e){next(e);}
  },express.raw({type:'application/octet-stream',limit:'10mb',inflate:false}),async(req,res)=>{
    if(!Buffer.isBuffer(req.body))throw new Fault(422,'INVALID_IMAGE','请上传图片文件字节。');
    const s=await jobs.uploadPhoto(res.locals.owner,id.parse(req.headers['x-shiye-operation-id']),req.body);
    res.status(201).json({...s,owner:undefined,operationId:undefined,sourceHash:undefined,mock:false});
  });
  app.use('/api',express.json({limit:'128kb',strict:true}));
  app.get('/api/session',(_req,res)=>{
    const sessions=store.data.sessions.filter(s=>s.owner===res.locals.owner&&s.expiresAt>Date.now()&&s.fixture===!live);
    const s=sessions.at(-1);
    res.json({mode:live?'live':'mock',mock:!live,session:s?{...s,owner:undefined,operationId:undefined,sourceHash:undefined}:null,job:s?.latestJobId?publicJob(jobs.get(res.locals.owner,s.latestJobId)):null});
  });
  app.post('/api/uploads/photo/init',async(req,res)=>{
    const input=initUpload.parse(req.body),s=await jobs.upload(res.locals.owner,input.operationId);
    res.status(201).json({...s,owner:undefined,operationId:undefined,mock:true});
  });
  app.put('/api/uploads/photo/:objectKey',(_req,_res,next)=>next(new Fault(403,'PHOTO_UPLOAD_NOT_APPROVED','本版本仅使用合成测试图，不接收个人照片。')));
  app.post('/api/segmentation/jobs',async(req,res)=>res.status(202).json(publicJob(await jobs.submit(res.locals.owner,startJob.parse(req.body),'auto'))));
  app.post('/api/segmentation/refine',async(req,res)=>res.status(202).json(publicJob(await jobs.submit(res.locals.owner,refineJob.parse(req.body),'refine'))));
  app.get('/api/jobs/:jobId',(req,res)=>res.json(publicJob(jobs.get(res.locals.owner,id.parse(req.params.jobId)))));
  app.post('/api/jobs/:jobId/cancel',async(req,res)=>res.json(publicJob(await jobs.cancel(res.locals.owner,id.parse(req.params.jobId)))));
  app.get('/api/media/:mediaId',(req,res,next)=>{
    const mediaId=id.parse(req.params.mediaId),m=store.data.media.find(m=>m.mediaId===mediaId&&m.owner===res.locals.owner);
    if(!m){next(new Fault(404,'NOT_FOUND','图片不存在。'));return;}
    if(m.expiresAt<=Date.now()){next(new Fault(410,'EXPIRED','临时图片已过期。'));return;}
    res.type('png').sendFile(store.mediaPath(mediaId),{dotfiles:'allow'},e=>{if(e)next(new Fault(404,'NOT_FOUND','临时图片不可读取。'));});
  });
  app.use('/api',(_req,_res,next)=>next(new Fault(404,'NOT_FOUND','接口不存在。')));
  // Explicit public-file allowlist: archives, documents, runtime and secrets are never served.
  const entries=new Set(['/','/index.html','/app.js','/styles.css','/segmentation.js','/selection.js','/segmentation.css',
    '/edgecut.js','/edgecut.css','/edgecut-core.js','/edgecut-worker.js',
    '/vendor/opencv-4.13.0/opencv.js','/vendor/opencv-4.13.0/LICENSE']);
  app.use((req,res,next)=>{
    const path=req.path;
    if(entries.has(path)||/^\/assets\/[a-zA-Z0-9_-]+\.(png|jpg|jpeg|webp|svg)$/.test(path)){
      express.static(staticRoot,{dotfiles:'deny',index:'index.html',fallthrough:false,maxAge:0})(req,res,next);
    }else res.sendStatus(404);
  });
  app.use((error:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{
    if(res.headersSent)return;
    const parseError=error as {type?:string;status?:number};
    const e=error instanceof Fault?error:error instanceof ZodError?new Fault(422,'INVALID_INPUT','输入内容或版本不符合要求。'):parseError?.type==='entity.too.large'?new Fault(413,'INPUT_TOO_LARGE','请求超过允许大小。'):parseError?.type==='entity.parse.failed'?new Fault(400,'INVALID_INPUT','请求不是有效 JSON。'):parseError?.status===404?new Fault(404,'NOT_FOUND','文件不存在。'):new Fault(500,'INTERNAL_ERROR','操作未完成，已有内容仍保留。');
    res.status(e.status).json({requestId:res.locals.requestId,error:{errorType:e.errorType,message:e.message,retryable:e.retryable}});
  });
  return {app,store,jobs};
}
function publicJob(job:ReturnType<Jobs['get']>) {
  const {owner:_,fingerprint:__,...result}=job;return result;
}
