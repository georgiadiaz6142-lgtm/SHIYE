import express from 'express';
import type { AICopy,CopyIdentity } from './ai-copy.js';
import type { Admin } from './admin.js';
import { adminToken } from './admin-routes.js';
import { captureTaskGrant } from './task-identity.js';
import { Fault } from '../shared/contracts.js';
export function copyRoutes(admin:Admin,copy:AICopy){
 const router=express.Router();
 router.use(async(req,res,next)=>{
  const authorize=async():Promise<CopyIdentity>=>{
   const account=await admin.resolveSession(adminToken(req.headers.cookie));let identity:CopyIdentity;
   if(account){const user=(await admin.access.snapshot())?.users?.find(u=>u.id===account.accountId);identity={owner:'account:'+account.accountId,...(user?{inviteId:user.inviteId,registeredAt:user.createdAt,...(user.memberUntil&&user.memberUntil>Date.now()?{member:true}:{})}:{})};}
   else{const token=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('shiye_invite='))?.slice(13),grant=await admin.access.status(token);if(!grant.authorized||!('inviteId' in grant))throw new Fault(401,'COPY_ACCESS_REQUIRED','请先登录账号或使用邀请码。');identity={owner:'invite:'+grant.inviteId};}
   if(req.headers['x-shiye-copy-owner']!==identity.owner)throw new Fault(409,'COPY_IDENTITY_CHANGED','身份已切换，请重新打开文案面板。');return identity;
  };
  res.locals.copyAuthorize=authorize;res.locals.copyIdentity=await authorize();next();
 });
 router.get('/status',async(_req,res)=>res.json(await copy.status(res.locals.copyIdentity)));
 router.post('/',express.json({limit:'256kb',strict:true,inflate:false}),async(req,res)=>{
  const invite=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('shiye_invite='))?.slice(13);
  const grant=copy.tasks?await captureTaskGrant(admin,adminToken(req.headers.cookie),invite):undefined;
  res.status(202).json(await copy.submit(res.locals.copyAuthorize,req.body,grant));
 });
 router.get('/:id',async(req,res)=>res.json(await copy.get(res.locals.copyIdentity,String(req.params.id))));
 return router;
}
