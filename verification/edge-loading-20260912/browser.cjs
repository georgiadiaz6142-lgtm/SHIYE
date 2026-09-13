const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('/Users/song/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'../..'),report={checks:[],errors:[],external:[],writes:[]};
const only=process.argv[2];
if(only&&!/^[a-z0-9-]+$/.test(only))throw Error('Invalid check name');
let browser,server,base,grant,vendorRequests=0;
const a=(p,name)=>p.locator(`[data-action="${name}"]`).first();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function shot(p,name){await p.screenshot({path:path.join(__dirname,name+'.png'),fullPage:true});}
async function geometry(p){await p.locator('#crop-stage').scrollIntoViewIfNeeded();return p.evaluate(()=>{const g=cropGeometry();return{x:g.rect.left+g.left,y:g.rect.top+g.top,w:g.width,h:g.height};});}
async function choose(p){
 await p.locator('.room-create').click();
 await p.locator('[data-action="nav"][data-view="workshop"]').first().click();
 await p.locator('#photo-input').setInputFiles(path.join(root,'shiye-editorial-prototype/assets/coffee.jpg'));
 await p.waitForFunction(()=>document.querySelector('#crop-source')?.naturalWidth>0);
}
async function select(p){
 await p.locator('[data-action="crop-mode"][data-value="rect"]').click();
 const g=await geometry(p);await p.mouse.move(g.x+g.w*.32,g.y+g.h*.09);await p.mouse.down();
 await p.mouse.move(g.x+g.w*.65,g.y+g.h*.52,{steps:8});await p.mouse.up();
}
async function ready(p,timeout=15000){await p.waitForFunction(()=>document.querySelector('.edge-mask')&&!document.querySelector('[data-action="edge-confirm"]').disabled,null,{timeout});}
async function seed(p){await a(p,'edge-remove').click();const g=await geometry(p);await p.mouse.click(g.x+g.w*.34,g.y+g.h*.11);}
async function flow(name,fn,options={},setup){
 if(only&&name!==only)return;
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',...options});
 await context.addCookies([{name:'shiye_invite',value:grant.token,domain:'127.0.0.1',path:'/api',sameSite:'Strict'}]);
 await context.addInitScript(()=>{
  const Native=Worker;window.edgeTrace={created:0,terminated:0,segments:0,ready:0,results:[]};window.edgeTestDelay=0;
  window.Worker=class extends Native{
   constructor(...args){super(...args);this.edgeWorker=String(args[0]).includes('edgecut-worker');if(this.edgeWorker){edgeTrace.created++;this.addEventListener('message',({data})=>{if(data.type==='ready')edgeTrace.ready++;if(data.type==='result')edgeTrace.results.push({ok:data.ok,elapsedMs:data.elapsedMs});});}}
   postMessage(...args){if(this.edgeWorker&&args[0]?.type==='segment'){edgeTrace.segments++;if(edgeTestDelay){setTimeout(()=>super.postMessage(...args),edgeTestDelay);return;}}super.postMessage(...args);}
   terminate(){if(this.edgeWorker)edgeTrace.terminated++;super.terminate();}
  };
 });
 await context.route('**/*',r=>{
  const req=r.request(),url=new URL(req.url());if(['data:','blob:'].includes(url.protocol))return r.continue();
  if(url.origin!==base){report.external.push(url.origin);return r.abort();}
  if(!['GET','HEAD'].includes(req.method())){report.writes.push(url.pathname);return r.abort();}
  if(url.pathname==='/room-home/index.html')return r.fulfill({contentType:'text/html',body:'<!doctype html><title>隔离工坊测试</title>'});
  return r.continue();
 });
 if(setup)await setup(context);
 const p=await context.newPage();p.setDefaultTimeout(10000);p.on('pageerror',e=>report.errors.push(e.message));
 try{await p.goto(base,{waitUntil:'domcontentloaded'});await choose(p);await fn(p,context);report.checks.push({name,status:'PASS'});console.log('PASS',name);}
 catch(e){report.checks.push({name,status:'FAIL',error:e.message});await shot(p,name+'-failure').catch(()=>{});console.log('FAIL',name,e.message);}
 finally{await context.close();}
}
async function transportProtocol(){
 const name='legacy-worker-and-browser-cache';if(only&&only!==name)return;
 const context=await browser.newContext(),p=await context.newPage();
 try{
  await p.goto(base+'/edgecut.css');const before=vendorRequests,measurements=[];
  for(const legacy of [true,false]){
   const workerEvent=p.waitForEvent('worker');
   const measured=await p.evaluate(legacy=>new Promise((resolve,reject)=>{
    const w=window.compatWorker=new Worker('/edgecut-worker.js'+(legacy?'':'?v=20260912-reuse-1'));
    const width=144,height=96,rgba=new Uint8ClampedArray(width*height*4),messages=[];
    for(let y=0;y<height;y++)for(let x=0;x<width;x++)rgba.set(x>50&&x<94&&y>24&&y<76?[40,95,45,255]:[225,215,190,255],(y*width+x)*4);
    const input={rgba,width,height,region:{x:.25,y:.15,w:.5,h:.75},seeds:[]};
    const timer=setTimeout(()=>reject(Error('Worker protocol timed out')),15000);
    w.onerror=e=>{clearTimeout(timer);reject(Error(e.message));};
    w.onmessage=({data})=>{
     messages.push(data.type);
     if(data.type==='ready')w.postMessage({type:'segment',id:1,input});
     else{clearTimeout(timer);resolve({ok:data.ok,messages,elapsedMs:data.elapsedMs});}
    };
    if(legacy)w.postMessage(input);
   }),legacy);
   const handle=await workerEvent;
   measured.resources=await handle.evaluate(()=>performance.getEntriesByType('resource').filter(r=>r.name.includes('/vendor/opencv')).map(r=>({transferSize:r.transferSize,encodedBodySize:r.encodedBodySize,decodedBodySize:r.decodedBodySize})));
   assert.equal(measured.ok,true);assert.deepEqual(measured.messages,legacy?['result']:['ready','result']);
   measurements.push(measured);await p.evaluate(()=>compatWorker.terminate());
  }
  assert.equal(vendorRequests-before,1,'a new worker in the same browser must reuse the cached OpenCV file');
  report.transport={requests:vendorRequests-before,measurements};report.checks.push({name,status:'PASS'});console.log('PASS',name);
 }catch(e){report.checks.push({name,status:'FAIL',error:e.message});console.log('FAIL',name,e.message);}
 finally{await context.close();}
}
(async()=>{
 const {InviteAccess,generateInvites}=await import(path.join(root,'dist/server/access.js'));
 const {createApp}=await import(path.join(root,'dist/server/app.js'));
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'shiye-edge-browser-')),batch=generateInvites(1),file=path.join(dir,'invites.json');
 fs.writeFileSync(file,JSON.stringify(batch.config));const access=new InviteAccess(file);grant=await access.verify(batch.codes[0],'edge-fixture','local');
 const {app}=await createApp({runtime:path.join(dir,'runtime'),staticRoot:path.join(root,'shiye-editorial-prototype'),access});
 server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base='http://127.0.0.1:'+server.address().port;
 server.on('request',req=>{if(req.url.startsWith('/vendor/opencv-4.13.0/opencv.js'))vendorRequests++;});
 browser=await chromium.launch({channel:'chrome',headless:true});
 await flow('desktop-reuse-undo-preview-save',async p=>{
  await select(p);await ready(p);const mask=await p.locator('.edge-mask').getAttribute('src');
  assert.equal(await p.evaluate(()=>edgeTrace.created),1);await seed(p);await ready(p);
  assert.equal(await p.evaluate(()=>edgeTrace.created),1);assert.equal(await p.evaluate(()=>edgeTrace.segments),2);
  await a(p,'undo-crop').click();await ready(p);assert.equal(await p.locator('.edge-mask').getAttribute('src'),mask);assert.equal(await p.evaluate(()=>edgeTrace.segments),2);
  const layout=await p.evaluate(()=>{const photo=document.querySelector('#crop-stage').getBoundingClientRect(),tools=document.querySelector('.edge-sidebar').getBoundingClientRect();return{photoRight:photo.right,toolsLeft:tools.left,overflow:document.documentElement.scrollWidth>innerWidth};});
  assert.ok(layout.toolsLeft>=layout.photoRight);assert.equal(layout.overflow,false);await shot(p,'desktop-right-panel');
  report.reuse=await p.evaluate(()=>edgeTrace);
  await a(p,'edge-confirm').click();await p.locator('#sticker-preview').waitFor();
  const pixel=await p.evaluate(async()=>{const image=document.querySelector('#sticker-preview');await image.decode();const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const g=canvas.getContext('2d');g.drawImage(image,0,0);const d=g.getImageData(0,0,canvas.width,canvas.height).data;let solid=0,clear=0;for(let i=3;i<d.length;i+=4){if(d[i]===255)solid++;if(d[i]===0)clear++;}return{solid,clear};});
  assert.ok(pixel.solid>0&&pixel.clear>0);
  const before=await p.evaluate(()=>state.assets.length);await a(p,'save-stickers').click();await p.waitForFunction(()=>currentView==='collection'&&saveStatus==='已保存到本机');
  const id=await p.evaluate(()=>state.assets.at(-1).id);assert.equal(await p.evaluate(()=>state.assets.length),before+1);
  assert.ok(await p.evaluate(()=>edgeTrace.terminated)>=1);
  await p.reload({waitUntil:'domcontentloaded'});await p.waitForFunction(()=>!!savedWorkspace);assert.ok(await p.evaluate(id=>state.assets.some(a=>a.id===id),id));
 });
 await flow('slow-first-load-exceeds-old-20s-limit',async p=>{
  await select(p);await p.waitForFunction(()=>edgeTrace.created===1);console.log('Waiting for deliberately delayed first tool load');
  await sleep(20500);assert.match(await p.locator('#edge-status').innerText(),/正在准备贴边工具/);assert.equal(await a(p,'edge-run').count(),0);
  await ready(p,15000);assert.equal(await p.evaluate(()=>edgeTrace.created),1);await seed(p);await ready(p);assert.equal(await p.evaluate(()=>edgeTrace.created),1);
 },{},async c=>{await c.route('**/vendor/opencv-4.13.0/opencv.js?*',async r=>{await sleep(22000);await r.continue().catch(()=>{});});});
 await flow('load-failure-and-explicit-retry',async p=>{
  await select(p);await a(p,'edge-run').waitFor();assert.match(await p.locator('#edge-status').innerText(),/工具.*失败/);
  assert.equal(await a(p,'edge-confirm').isDisabled(),true);const count=await p.evaluate(()=>edgeTrace.created);await sleep(500);assert.equal(await p.evaluate(()=>edgeTrace.created),count);
  await a(p,'edge-run').click();await ready(p);assert.equal(await p.evaluate(()=>edgeTrace.created),2);
 },{},async c=>{let first=true;await c.route('**/vendor/opencv-4.13.0/opencv.js?*',r=>{if(first){first=false;return r.abort();}return r.continue();});});
 await flow('cancel-compute-retains-mask-and-retry',async p=>{
  await select(p);await ready(p);const mask=await p.locator('.edge-mask').getAttribute('src');await p.evaluate(()=>edgeTestDelay=1500);
  await seed(p);await a(p,'edge-cancel').click();assert.match(await p.locator('#edge-status').innerText(),/已取消/);
  assert.equal(await p.locator('.edge-mask').getAttribute('src'),mask);assert.equal(await a(p,'edge-confirm').isDisabled(),true);
  await sleep(1700);assert.equal(await p.locator('.edge-mask').getAttribute('src'),mask);
  await p.evaluate(()=>edgeTestDelay=0);await a(p,'edge-run').click();await ready(p);assert.equal(await p.evaluate(()=>edgeTrace.created),2);
  await p.evaluate(()=>edgeTestDelay=1000);await seed(p);await a(p,'workshop-reset').click();await p.locator('#upload-zone').waitFor();await sleep(1200);assert.equal(await p.locator('.edge-mask').count(),0);
 });
 await flow('compute-timeout-is-distinct-and-recoverable',async p=>{
  await p.evaluate(()=>edgeTestDelay=3000);await select(p);await a(p,'edge-run').waitFor();assert.match(await p.locator('#edge-status').innerText(),/贴边计算超过 20 秒/);
  assert.equal(await a(p,'edge-confirm').isDisabled(),true);await p.evaluate(()=>edgeTestDelay=0);await a(p,'edge-run').click();await ready(p);
 },{},async c=>{await c.addInitScript(()=>{const schedule=window.setTimeout;window.setTimeout=(fn,ms,...args)=>schedule(fn,ms===20000?1500:ms,...args);});});
 await flow('loading-timeout-is-distinct',async p=>{
  await select(p);await a(p,'edge-run').waitFor();assert.match(await p.locator('#edge-status').innerText(),/工具加载超时/);assert.equal(await a(p,'edge-confirm').isDisabled(),true);
 },{},async c=>{
  await c.addInitScript(()=>{const schedule=window.setTimeout;window.setTimeout=(fn,ms,...args)=>schedule(fn,ms===60000?1200:ms,...args);});
  await c.route('**/vendor/opencv-4.13.0/opencv.js?*',async r=>{await sleep(2500);await r.continue().catch(()=>{});});
 });
 await flow('mobile-bottom-panel-touch-and-manual',async p=>{
  await p.locator('[data-action="crop-mode"][data-value="outline"]').click();
  for(const[x,y]of[[.32,.09],[.65,.09],[.65,.52],[.32,.52],[.32,.09]]){const g=await geometry(p);await p.touchscreen.tap(g.x+g.w*x,g.y+g.h*y);}
  await ready(p);await a(p,'edge-keep').click();let g=await geometry(p);await p.touchscreen.tap(g.x+g.w*.49,g.y+g.h*.29);await ready(p);assert.equal(await p.evaluate(()=>edgeTrace.created),1);
  const layout=await p.evaluate(()=>{const photo=document.querySelector('#crop-stage').getBoundingClientRect(),tools=document.querySelector('.edge-sidebar').getBoundingClientRect();return{photoBottom:photo.bottom,toolsTop:tools.top,width:document.documentElement.scrollWidth};});
  assert.ok(layout.toolsTop>=layout.photoBottom);assert.equal(layout.width,390);await shot(p,'mobile-bottom-panel');
  for(const width of [320,800,1024]){await p.setViewportSize({width,height:1000});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),width);}
  await a(p,'edge-disable').click();assert.equal(await p.locator('.manual-crop-panel').count(),1);assert.equal(await a(p,'generate').isVisible(),true);await shot(p,'manual-mode-preserved');
 },{viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await transportProtocol();
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.external,[]);assert.deepEqual(report.writes,[]);
})().catch(e=>{report.fatal=e.stack;}).finally(async()=>{
 await browser?.close();if(server)await new Promise(r=>server.close(r));
 fs.writeFileSync(path.join(__dirname,only?'results-'+only+'.json':'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 process.exitCode=report.fatal||report.checks.some(c=>c.status!=='PASS')?1:0;
});
