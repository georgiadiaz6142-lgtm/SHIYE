import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp,readFile,writeFile,stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import sharp from 'sharp';
import { Works } from '../works.js';
import { LocalWorkObjects,LocalWorkRepository,type WorkRepository } from '../work-storage.js';
import { bookPackage } from '../../shared/works.js';
import { Fault } from '../../shared/contracts.js';
import { Admin } from '../admin.js';
import { InviteAccess,generateInvites } from '../access.js';
import { createApp } from '../app.js';

const png=()=>sharp({create:{width:64,height:80,channels:4,background:{r:120,g:80,b:40,alpha:.5}}}).png().toBuffer();
const packageFor=(imageId:string,bookId=randomUUID())=>({schemaVersion:1 as const,book:{id:bookId,title:'可继续编辑的手账',cover:'olive',page:0,editorLayout:'spread' as const,stickerPlacement:'spread' as const,pages:[
 {id:'left-page',paper:'plain',spreadKey:'spread-1',spreadSide:'left' as const,paperSpread:{paper:'texture-butterfly-botanical',side:'left' as const},elements:[{id:'text-1',type:'text' as const,text:'宋体和竖排\n保留原位',x:12,y:8,w:40,h:65,size:23,rotation:-5,font:'fangsong' as const,direction:'vertical' as const,color:'#556644',locked:true},{id:'sticker-1',type:'sticker' as const,x:80,y:40,w:35,rotation:6,flip:true,assetId:'archived-sticker',spreadWith:'right-page'}]},
 {id:'right-page',paper:'plain',spreadKey:'spread-1',spreadSide:'right' as const,paperSpread:{paper:'texture-butterfly-botanical',side:'right' as const},elements:[]},
]},assets:[{id:'archived-sticker',name:'已从素材库删除但书页仍在使用',category:'照片',archived:true,border:4,borderBaked:true,image:{imageId}}]});
async function fixture(){const root=await mkdtemp(join(tmpdir(),'shiye-works-')),repository=new LocalWorkRepository(join(root,'metadata')),objects=new LocalWorkObjects(join(root,'objects')),owner=randomUUID();return {root,repository,objects,owner,works:new Works(repository,objects,async()=>true)};}
const failure=(type:string)=>(e:unknown)=>e instanceof Fault&&e.errorType===type;

test('local works survive restart with editable cross-page content, archived images and private immutable files',async()=>{
 const f=await fixture(),imageId=randomUUID(),image=await png(),content=packageFor(imageId);
 const meta=await f.works.upload(f.owner,imageId,image);assert.equal(meta.width,64);assert.equal(meta.height,80);
 const first=await f.works.save(f.owner,content.book.id,{operationId:randomUUID(),baseRevision:0,content});assert.equal(first.revision,1);
 const fresh=new Works(new LocalWorkRepository(join(f.root,'metadata')),new LocalWorkObjects(join(f.root,'objects')),async()=>true);
 assert.deepEqual((await fresh.get(f.owner,content.book.id)).content,content);
 assert.deepEqual(await fresh.list(f.owner),[{...first,title:content.book.title}]);
 assert.ok((await sharp(await fresh.image(f.owner,imageId)).metadata()).hasAlpha);
 const other=randomUUID();assert.deepEqual(await fresh.list(other),[]);await assert.rejects(fresh.get(other,content.book.id),failure('WORK_NOT_FOUND'));await assert.rejects(fresh.image(other,imageId),failure('WORK_IMAGE_NOT_FOUND'));
 const state=await f.repository.read(f.owner);assert.equal((await stat(join(f.root,'metadata',f.owner+'.json'))).mode&0o777,0o600);assert.equal((await stat(join(f.root,'objects',f.owner,state.images[0].hash+'.png'))).mode&0o777,0o600);
});

test('save and image retries are idempotent, conflicting writers and re-used operation IDs cannot overwrite',async()=>{
 const f=await fixture(),imageId=randomUUID(),image=await png();
 await Promise.all([f.works.upload(f.owner,imageId,image),f.works.upload(f.owner,imageId,image)]);assert.equal((await f.repository.read(f.owner)).images.length,1);
 const content=packageFor(imageId),input={operationId:randomUUID(),baseRevision:0,content};
 const [a,b]=await Promise.all([f.works.save(f.owner,content.book.id,input),f.works.save(f.owner,content.book.id,input)]);assert.deepEqual(a,b);assert.equal((await f.works.list(f.owner)).length,1);
 const otherImage=await sharp({create:{width:64,height:80,channels:4,background:'blue'}}).png().toBuffer();await assert.rejects(f.works.upload(f.owner,imageId,otherImage),failure('IMAGE_ID_CONFLICT'));
 await assert.rejects(f.works.save(f.owner,content.book.id,{...input,content:{...content,book:{...content.book,title:'替换'}}}),failure('OPERATION_CONFLICT'));
 const updates=await Promise.allSettled(['甲','乙'].map(title=>f.works.save(f.owner,content.book.id,{operationId:randomUUID(),baseRevision:1,content:{...content,book:{...content.book,title}}})));
 assert.equal(updates.filter(r=>r.status==='fulfilled').length,1);assert.equal(updates.filter(r=>r.status==='rejected'&&failure('WORK_REVISION_CONFLICT')(r.reason)).length,1);
 assert.equal((await f.works.get(f.owner,content.book.id)).revision,2);
 assert.deepEqual(await f.works.save(f.owner,content.book.id,input),a);assert.equal((await f.works.get(f.owner,content.book.id)).revision,2);
});

test('missing, foreign and corrupt image files cannot publish a book; failed object writes leave no visible metadata',async()=>{
 const f=await fixture(),imageId=randomUUID(),content=packageFor(imageId),input={operationId:randomUUID(),baseRevision:0,content};
 await f.works.upload(randomUUID(),imageId,await png());await assert.rejects(f.works.save(f.owner,content.book.id,input),failure('WORK_IMAGE_MISSING'));assert.deepEqual(await f.works.list(f.owner),[]);
 const broken=new Works(f.repository,{get:async()=>{throw Error('offline');},put:async()=>{throw Error('disk full');}},async()=>true);
 await assert.rejects(broken.upload(f.owner,imageId,await png()),/disk full/);assert.equal((await f.repository.read(f.owner)).images.length,0);
 await f.works.upload(f.owner,imageId,await png());const state=await f.repository.read(f.owner);await writeFile(join(f.root,'objects',f.owner,state.images[0].hash+'.png'),'corrupt');
 await assert.rejects(f.works.save(f.owner,content.book.id,input),failure('WORK_IMAGE_UNAVAILABLE'));assert.deepEqual(await f.works.list(f.owner),[]);
});

test('failed metadata transaction preserves prior book; corrupted metadata is never reset',async()=>{
 const f=await fixture(),imageId=randomUUID(),content=packageFor(imageId);await f.works.upload(f.owner,imageId,await png());await f.works.save(f.owner,content.book.id,{operationId:randomUUID(),baseRevision:0,content});
 const failing:WorkRepository={read:o=>f.repository.read(o),transaction:async(o,change)=>{await change(await f.repository.read(o));throw Error('commit failed');}};
 const broken=new Works(failing,f.objects,async()=>true);await assert.rejects(broken.save(f.owner,content.book.id,{operationId:randomUUID(),baseRevision:1,content:{...content,book:{...content.book,title:'未保存的修改'}}}),/commit failed/);
 assert.equal((await f.works.get(f.owner,content.book.id)).content.book.title,content.book.title);
 const file=join(f.root,'metadata',f.owner+'.json');await writeFile(file,'corrupted metadata');await assert.rejects(f.works.list(f.owner));await assert.rejects(f.works.upload(f.owner,randomUUID(),await png()));assert.equal(await readFile(file,'utf8'),'corrupted metadata');
});

test('work contracts reject owner injection, ephemeral URLs, missing asset references and broken spreads',()=>{
 const content=packageFor(randomUUID());assert.ok(bookPackage.safeParse(content).success);
 for(const invalid of [ {...content,ownerId:randomUUID()}, {...content,assets:[]}, {...content,assets:[{...content.assets[0],image:{imageId:randomUUID(),url:'https://example.com'}}]}, {...content,assets:[{...content.assets[0],image:{builtinPath:'assets/../../.env.local'}}]}, {...content,book:{...content.book,pages:[content.book.pages[0]]}} ])assert.equal(bookPackage.safeParse(invalid).success,false);
});

test('works HTTP APIs enforce account ownership, CSRF, body limits, logout and authenticated restart recovery',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'shiye-works-http-')),batch=generateInvites(3),file=join(dir,'invites.json');await writeFile(file,JSON.stringify(batch.config));
 const access=new InviteAccess(file);let admin=new Admin(join(dir,'admin.json'),access);await admin.init({apiKey:'test',secretKey:'test',cutout:false,naming:false},join(dir,'receipt'));
 for(const [index,name] of ['user-a','user-b'].entries()){const grant=await access.verify(batch.codes[index],name,'local');await admin.register(grant.token,{username:name,password:'test-password-123'});}
 const options={runtime:join(dir,'runtime'),staticRoot:resolve('shiye-editorial-prototype'),access};
 let server=(await createApp({...options,admin})).app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));let base=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
 const client=async(name?:string)=>{const cookie=(await fetch(base+'/api/access/session')).headers.getSetCookie()[0].split(';')[0];return cookie+(name?'; shiye_admin='+await admin.login(name,'test-password-123','local'):'');};
 const request=(cookie:string,path:string,method='GET',body?:unknown,extra:Record<string,string>={})=>fetch(base+'/api/works'+path,{method,headers:{origin:base,cookie,...(Buffer.isBuffer(body)?{'content-type':'application/octet-stream'}:body!==undefined?{'content-type':'application/json'}:{}),...extra},body:Buffer.isBuffer(body)?new Uint8Array(body):body===undefined?undefined:JSON.stringify(body)});
 try{
  const a=await client('user-a'),b=await client('user-b'),guest=await client(),imageId=randomUUID(),content=packageFor(imageId),input={operationId:randomUUID(),baseRevision:0,content};
  assert.equal((await request(guest,'/books')).status,401);
  const grant=await access.verify(batch.codes[2],'guest','local');assert.equal((await request(guest+'; shiye_invite='+grant.token,'/books')).status,401);
  assert.equal((await request(a,'/images/'+imageId,'POST',await png(),{origin:'https://foreign.example'})).status,403);
  assert.equal((await request(a,'/images/'+imageId,'POST',Buffer.alloc(10*1024*1024+1))).status,413);
  assert.equal((await request(a,'/images/'+imageId,'POST',Buffer.from('<svg onload="alert(1)"/>'))).status,422);
  assert.equal((await request(a,'/images/'+imageId,'POST',await png())).status,200);
  assert.equal((await request(b,'/books/'+content.book.id,'PUT',input)).status,422);
  const saved=await request(a,'/books/'+content.book.id,'PUT',input);assert.equal(saved.status,200);assert.equal(saved.headers.get('x-shiye-work-storage'),'local-development');assert.equal((await saved.json()).revision,1);
  assert.equal((await request(a,'/books/'+content.book.id,'PUT',{...input,ownerId:'forged'})).status,422);
  assert.equal((await request(b,'/books/'+content.book.id)).status,404);assert.equal((await request(b,'/images/'+imageId)).status,404);assert.deepEqual((await(await request(b,'/books')).json()).books,[]);
  assert.equal((await request(a,'/books/'+content.book.id)).headers.get('cache-control'),'no-store');
  const accountA=admin.session(a.split('shiye_admin=')[1])!.accountId;
  await new Promise<void>(r=>server.close(()=>r()));
  admin=new Admin(join(dir,'admin.json'),new InviteAccess(file));await admin.init({apiKey:'ignored',secretKey:'ignored',cutout:false,naming:false},join(dir,'receipt'));
  server=(await createApp({...options,admin})).app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));base=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
  assert.equal((await request(a,'/books')).status,401);const again=await client('user-a');assert.equal(admin.session(again.split('shiye_admin=')[1])!.accountId,accountA);
  assert.deepEqual((await(await request(again,'/books/'+content.book.id)).json()).content,content);
  const downloaded=await request(again,'/images/'+imageId);assert.equal(downloaded.status,200);assert.ok((await sharp(Buffer.from(await downloaded.arrayBuffer())).metadata()).hasAlpha);
  await admin.logout(again.split('shiye_admin=')[1]);assert.equal((await request(again,'/books')).status,401);
 }finally{await new Promise<void>(r=>server.close(()=>r()));}
});
