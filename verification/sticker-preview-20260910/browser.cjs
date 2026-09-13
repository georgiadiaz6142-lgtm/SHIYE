const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('/Users/song/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'../..'),checks=[],errors=[];let browser,server,p;
(async()=>{
 const {Admin}=await import(path.join(root,'dist/server/admin.js')),{InviteAccess,generateInvites}=await import(path.join(root,'dist/server/access.js')),{createApp}=await import(path.join(root,'dist/server/app.js'));
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'shiye-page-turn-')),batch=generateInvites(1),file=path.join(dir,'invites.json');fs.writeFileSync(file,JSON.stringify(batch.config));const access=new InviteAccess(file),admin=new Admin(path.join(dir,'admin.json'),access);await admin.init({apiKey:'fixture',secretKey:'fixture',cutout:false,naming:false},path.join(dir,'receipt'));
 const grant=await access.verify(batch.codes[0],'fixture','local');await admin.register(grant.token,{username:'style-user',password:'fixture-password-123'});
 const {app}=await createApp({runtime:path.join(dir,'runtime'),staticRoot:path.join(root,'shiye-editorial-prototype'),admin,access,copyProvider:{generate:async()=>({text:'把今天慢慢收好。',provider:'test',model:'fixture'})}});server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());await context.request.get(base+'/api/access/session');await context.request.post(base+'/api/access/login',{headers:{origin:base},data:{username:'style-user',password:'fixture-password-123'}});
 p=await context.newPage();p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(e.message));await p.goto(base);const ready=()=>p.waitForFunction(()=>workSync&&!workSync.running&&workSync.label==='已同步到当前服务');await ready();
 await p.evaluate(async()=>{const b=seed().books[0];b.id='menu-book';b.page=0;b.editorLayout='single';state.assets=[clone(builtin.find(a=>a.id==='orange'))];b.pages=[{id:'p0',paper:'plain',spreadKey:'pair-a',spreadSide:'left',elements:[{id:'text',type:'text',text:'保留文字样式',font:'fangsong',size:30.5,bold:true,color:'#315b90',direction:'horizontal',x:12,y:12,w:45,rotation:2},{id:'sticker',type:'sticker',assetId:'orange',x:65,y:65,w:20,rotation:5}]},{id:'p1',paper:'plain',spreadKey:'pair-a',spreadSide:'right',elements:[]},{id:'p2',paper:'plain',spreadKey:'pair-b',spreadSide:'left',elements:[]},{id:'p3',paper:'plain',spreadKey:'pair-b',spreadSide:'right',elements:[]}];state.books=[b];dirty();await saveNow();openBook(b.id,true);});await ready();


 await p.evaluate(async()=>{
  const make=(id,w,h,x,y,rw,rh,color)=>{const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');ctx.fillStyle=color;ctx.fillRect(x,y,rw,rh);return {...clone(builtin[0]),id,name:id,category:'照片',src:c.toDataURL(),createdAt:Date.now(),favorite:true};};
  state.assets=[make('tall',256,1024,78,32,100,960,'#c65740'),make('padded',800,800,300,300,200,200,'#6e854d'),make('wide',1024,256,50,110,920,36,'#d79553'),make('square',400,400,0,0,400,400,'#e0ac71'),...builtin.slice(0,3).map(a=>({...clone(a),favorite:true}))];
  const c=document.createElement('canvas');c.width=c.height=200;state.assets.push({...clone(builtin[0]),id:'transparent',name:'透明图兜底',category:'照片',src:c.toDataURL(),createdAt:Date.now()});
  dirty();await saveNow();currentView='collection';collectionTab='mine';render();
 });await ready();
 const original=await p.evaluate(()=>JSON.stringify(state.assets));
 async function loaded(){await p.waitForFunction(()=>[...document.querySelectorAll('.sticker-display img')].filter(im=>{const r=im.getBoundingClientRect();return im.closest('[data-asset-id]').dataset.assetId!=='transparent'&&r.bottom>0&&r.top<innerHeight;}).every(im=>im.dataset.previewReady==='true'));}
 // Bring lazy images through the viewport before the checks.
 for(const card of await p.locator('.sticker-display').all())await card.scrollIntoViewIfNeeded();await p.evaluate(()=>scrollTo(0,0));await loaded();
 const shape=await p.locator('[data-asset-id="padded"] img').evaluate(im=>({width:im.naturalWidth,height:im.naturalHeight}));assert.ok(shape.width<210&&shape.height<210);checks.push('Transparent padding is removed only from the displayed thumbnail');
 const ratios=[];for(const id of ['tall','padded','wide','square'])ratios.push(await p.locator('[data-asset-id="'+id+'"] img').evaluate(im=>im.naturalWidth/im.naturalHeight));assert.ok(ratios[0]<.12&&ratios[2]>20&&Math.abs(ratios[1]-1)<.01);checks.push('Tall, wide and square visible subjects keep their proportions');
 async function fits(card){return card.evaluate(el=>{
  const frame=el.querySelector('.sticker-preview-frame'),im=frame.querySelector('img'),r=el.getBoundingClientRect(),f=frame.getBoundingClientRect(),matrix=new DOMMatrix(getComputedStyle(frame).transform);
  const scale=Math.min(frame.clientWidth/im.naturalWidth,frame.clientHeight/im.naturalHeight),w=im.naturalWidth*scale,h=im.naturalHeight*scale;
  const cx=(f.left+f.right)/2,cy=(f.top+f.bottom)/2;
  const points=[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]].map(([x,y])=>({x:cx+matrix.a*x+matrix.c*y,y:cy+matrix.b*x+matrix.d*y}));
  return {fits:points.every(p=>p.x>=r.left+3&&p.x<=r.right-3&&p.y>=r.top+3&&p.y<=r.bottom-6),scale:Math.hypot(matrix.a,matrix.b),height:r.height};
 });}
 for(const width of [390,768,1440]){
  await p.setViewportSize({width,height:1100});await loaded();
  const cards=p.locator('.sticker-display');const heights=[];
  for(let i=0;i<4;i++){const card=p.locator('[data-asset-id="'+['tall','padded','wide','square'][i]+'"] .sticker-display');await card.scrollIntoViewIfNeeded();await p.mouse.move(0,0);await p.waitForTimeout(240);const normal=await fits(card);assert.ok(normal.fits,JSON.stringify({width,i,normal}));await card.hover();await p.waitForTimeout(240);const hover=await fits(card);assert.ok(hover.fits,JSON.stringify({width,i,hover}));assert.ok(hover.scale>1.05);heights.push(hover.height);}
  assert.ok(Math.max(...heights)-Math.min(...heights)<1);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);checks.push({width,uniformCardHeight:heights[0],hoverFits:true});
  await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:path.join(__dirname,'library-'+width+'.png'),fullPage:true});
 }
 assert.equal(await p.evaluate(()=>JSON.stringify(state.assets)),original);checks.push('Previewing, hovering and resizing do not change any original asset');
 await p.evaluate(()=>{openBook('menu-book',true);drawer='sticker';renderEditor();});await loaded();
 for(const width of [1440,768,390]){
  await p.setViewportSize({width,height:1000});const card=p.locator('.sticker-display').first();await card.scrollIntoViewIfNeeded();await card.hover();await p.waitForTimeout(240);assert.ok((await fits(card)).fits);checks.push({editorWidth:width,contained:true});
 }
 await p.locator('[data-action="insert-sticker"][data-id="padded"]').click();
 assert.equal(await p.evaluate(()=>currentPage().elements.at(-1).assetId),'padded');
 assert.equal(await p.evaluate(()=>JSON.stringify(state.assets)),original);checks.push('Insert still references the original full-resolution asset');
 await p.evaluate(()=>{currentView='collection';collectionTab='mine';render();});await loaded();checks.push('Re-entering library rebuilds previews from the cache');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({status:'PASS',checks,errors}));
})().catch(async e=>{console.error(e.stack);checks.push({failure:e.stack});await p?.screenshot({path:path.join(__dirname,'failure.png'),fullPage:true}).catch(()=>{});process.exitCode=1;}).finally(async()=>{await browser?.close();if(server)await new Promise(r=>server.close(r));fs.writeFileSync(path.join(__dirname,'results.json'),JSON.stringify({status:process.exitCode?'FAIL':'PASS',checks,errors},null,2));});
