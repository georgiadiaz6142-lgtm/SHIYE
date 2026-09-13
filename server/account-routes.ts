import {sessionCookie} from './http-policy.js';
import {Router} from 'express';
import {z} from 'zod';
import {Admin} from './admin.js';
import {InviteAccess} from './access.js';
import {adminToken} from './admin-routes.js';
import {Fault} from '../shared/contracts.js';
export const inviteToken=(cookie?:string)=>cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('shiye_invite='))?.slice(13);
export function accountRoutes(admin:Admin,access:InviteAccess){
 const router=Router();
 router.get('/',async(req,res)=>{
  const token=adminToken(req.headers.cookie);
  if(await admin.resolveSession(token)){res.json({account:await admin.profile(token)});return;}
  if((await access.status(inviteToken(req.headers.cookie))).authorized){res.json({account:null,canSetCredentials:true});return;}
  throw new Fault(401,'ACCOUNT_REQUIRED','请先登录或使用邀请码进入。');
 });
 router.post('/register',async(req,res)=>{
  if(await admin.resolveSession(adminToken(req.headers.cookie)))throw new Fault(409,'ALREADY_REGISTERED','当前已经登录账号。');
  const user=await admin.register(inviteToken(req.headers.cookie),req.body);
  const token=await admin.login(user.username,req.body.password,req.socket.remoteAddress||'local');
  res.cookie('shiye_admin',token,sessionCookie(res,8*3600000));res.clearCookie('shiye_invite',sessionCookie(res));res.json({account:await admin.profile(token)});
 });
 router.post('/logout',async(req,res)=>{
  const token=adminToken(req.headers.cookie);if(token)await admin.logout(token);
  res.clearCookie('shiye_admin',sessionCookie(res));res.clearCookie('shiye_invite',sessionCookie(res));res.json({ok:true});
 });
 router.use(async(req,res,next)=>{const token=adminToken(req.headers.cookie),session=await admin.resolveSession(token);if(!session)throw new Fault(401,'ACCOUNT_REQUIRED','请先登录账号。');res.locals.accountToken=token;res.locals.accountId=session.accountId;next();});
 router.post('/profile',async(req,res)=>res.json({account:await admin.updateProfile(res.locals.accountToken,req.body)}));
 router.post('/password',async(req,res)=>{
  const input=z.object({oldPassword:z.string().max(128),newPassword:z.string().min(12).max(128)}).strict().parse(req.body);
  await admin.setPassword(res.locals.accountId,input.oldPassword,input.newPassword);res.clearCookie('shiye_admin',sessionCookie(res));res.clearCookie('shiye_invite',sessionCookie(res));res.json({ok:true});
 });
 return router;
}
