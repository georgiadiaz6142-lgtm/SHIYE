import { Router } from 'express';
import { z } from 'zod';
import { Admin,feature } from './admin.js';
import { Fault } from '../shared/contracts.js';
export const adminToken=(cookie?:string)=>cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('shiye_admin='))?.slice(12);
export function adminRoutes(admin:Admin){
 const router=Router();router.use((req,res,next)=>{res.setHeader('Cache-Control','no-store');next();});
 router.get('/session',(req,res)=>{const session=admin.session(adminToken(req.headers.cookie));res.json({authenticated:!!session,...(session?{username:session.username}:{})});});
 router.post('/login',async(req,res)=>{const token=await admin.login(req.body?.username,req.body?.password,req.socket.remoteAddress||'local');res.cookie('shiye_admin',token,{httpOnly:true,sameSite:'strict',path:'/api',maxAge:8*3600000});res.json({authenticated:true});});
 router.use((req,res,next)=>{const token=adminToken(req.headers.cookie),session=admin.session(token);if(!session)throw new Fault(403,'ADMIN_REQUIRED','请先登录管理员账号。');res.locals.admin=session.username;res.locals.adminToken=token;next();});
 router.post('/logout',async(req,res)=>{await admin.logout(res.locals.adminToken);res.clearCookie('shiye_admin',{path:'/api'});res.json({ok:true});});
 router.post('/password',async(req,res)=>{await admin.changePassword(res.locals.admin,req.body?.oldPassword,req.body?.newPassword);res.clearCookie('shiye_admin',{path:'/api'});res.json({ok:true});});
 router.get('/overview',async(_req,res)=>{const [invites,apis,logs]=await Promise.all([admin.invites(),admin.apiList(),admin.logs()]);res.json({total:invites.length,counts:Object.fromEntries(['unused','used','unknown','disabled','bound','expired'].map(s=>[s,invites.filter(i=>i.state===s).length])),apis,recent:logs.slice(0,8)});});
 router.get('/invites',async(req,res)=>{let rows=await admin.invites();const q=String(req.query.q||'').slice(0,100),state=String(req.query.state||'');if(q)rows=rows.filter(r=>[r.id,r.batch,r.note,r.codeMasked].some(s=>s?.includes(q)));if(state)rows=rows.filter(r=>r.state===state);rows.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));res.json({items:rows});});
 router.post('/invites',async(req,res)=>res.status(201).json(await admin.createInvites(res.locals.admin,req.body)));
 router.post('/invites/reveal',async(req,res)=>{const input=z.object({ids:z.array(z.string().uuid()).min(1).max(1000)}).parse(req.body);res.json({items:await admin.reveal(res.locals.admin,input.ids)});});
 router.post('/invites/:id/status',async(req,res)=>{await admin.setInvite(res.locals.admin,z.string().uuid().parse(req.params.id),z.boolean().parse(req.body?.disabled));res.json({ok:true});});
 router.get('/apis',async(_req,res)=>res.json({items:await admin.apiList()}));
 router.post('/apis/:kind/test',async(req,res)=>res.json(await admin.testApi(res.locals.admin,res.locals.adminToken,feature.parse(req.params.kind),req.body)));
 router.post('/apis/:kind',async(req,res)=>{await admin.saveApi(res.locals.admin,res.locals.adminToken,feature.parse(req.params.kind),req.body);res.json({ok:true});});
 router.get('/audit',async(req,res)=>{const logs=await admin.logs(),q=String(req.query.q||'').slice(0,100);res.json({items:logs.filter(r=>!q||[r.actor,r.action,r.target].some(s=>s.includes(q))).slice(0,1000)});});
 return router;
}
