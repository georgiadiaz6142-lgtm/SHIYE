import express from 'express';
import type { Admin } from './admin.js';
import { adminToken } from './admin-routes.js';
import { Fault } from '../shared/contracts.js';
import type { Works } from './works.js';

export function workRoutes(admin:Admin,works:Works,storage:'local-development'|'tos'='local-development'){
 const router=express.Router();
 // An invitation grant alone is not an account. Never trust ownerId supplied in the body or URL.
 router.use(async(req,res,next)=>{const session=await admin.resolveSession(adminToken(req.headers.cookie));if(!session)throw new Fault(401,'ACCOUNT_REQUIRED','请先登录账号后保存作品。');if(req.headers['x-shiye-work-account']&&req.headers['x-shiye-work-account']!==session.accountId)throw new Fault(409,'WORK_ACCOUNT_CHANGED','账号已切换，已停止原账号同步。');res.locals.workOwner=session.accountId;next();});
 router.use((_req,res,next)=>{res.setHeader('X-Shiye-Work-Storage',storage);next();});
 router.get('/workspace',async(_req,res)=>res.json(await works.workspace(res.locals.workOwner)));
 router.put('/workspace',express.json({limit:'16mb',strict:true,inflate:false}),async(req,res)=>res.json(await works.saveWorkspace(res.locals.workOwner,req.body)));
 router.get('/status',(_req,res)=>res.json({storage,cloudConnected:storage==='tos'}));
 router.post('/images/:imageId',express.raw({type:'application/octet-stream',limit:'10mb',inflate:false}),async(req,res)=>{
  if(!Buffer.isBuffer(req.body))throw new Fault(422,'INVALID_WORK_IMAGE','请上传作品图片字节。');
  res.json(await works.upload(res.locals.workOwner,String(req.params.imageId),req.body));
 });
 router.get('/images/:imageId',async(req,res)=>{res.type('png').send(await works.image(res.locals.workOwner,String(req.params.imageId)));});
 router.get('/books',async(_req,res)=>res.json({books:await works.list(res.locals.workOwner)}));
 router.get('/books/:bookId',async(req,res)=>res.json(await works.get(res.locals.workOwner,String(req.params.bookId))));
 router.put('/books/:bookId',express.json({limit:'2mb',strict:true,inflate:false}),async(req,res)=>res.json(await works.save(res.locals.workOwner,String(req.params.bookId),req.body)));
 return router;
}
