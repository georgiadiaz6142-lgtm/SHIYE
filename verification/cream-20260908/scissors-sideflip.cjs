const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require('/Users/song/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const label=process.argv[2];if(!/^[a-z0-9-]+$/.test(label||''))throw Error('unique label required');
const out=path.join(__dirname,label);fs.mkdirSync(out);const src=path.resolve(__dirname,'../../shiye-editorial-prototype'),url='http://127.0.0.1:4176';
const report={target:url,checks:[],errors:[],externalRequests:[],screenshots:[]};let browser;
const A=(p,a,v)=>p.locator(`[data-action="${a}"]${v===undefined?'':`[data-value="${v}"]`}`).first();
const click=async(p,a,v)=>{await A(p,a,v).click();if(a==='mode')await p.locator(v==='read'?'.read-mode':'.editor-dock').waitFor();};
const shot=async(p,n)=>{await p.screenshot({path:path.join(out,n+'.png'),fullPage:true});report.screenshots.push(n+'.png');};
const saved=async p=>{await p.waitForFunction(()=>document.querySelector('.local-status')?.textContent==='已保存到本机');return p.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('shiye-concept-v1',1);r.onsuccess=()=>{const db=r.result,q=db.transaction('data').objectStore('data').get('workspace');q.onsuccess=()=>{db.close();resolve(q.result)};};}));};
const newBook=async(p,title)=>{await click(p,'new-book');await p.locator('#new-title').fill(title);await click(p,'create-book');await p.locator('#canvas-page').waitFor();return (await saved(p)).books.find(b=>b.title===title).id;};
const text=async(p,value,direction='horizontal')=>{await click(p,'drawer','text');await click(p,'add-text');await p.locator('#text-content').fill(value);await p.locator('#text-direction').selectOption(direction);await click(p,'save-text');};
const drag=async(p,from,to)=>{await p.mouse.move(from.x,from.y);await p.mouse.down();await p.mouse.move(to.x,to.y,{steps:16});await p.mouse.up();};
const geom=p=>p.locator('#canvas-page .selected').evaluate(e=>({x:parseFloat(e.style.left),y:parseFloat(e.style.top),w:parseFloat(e.style.width),rotation:e.style.transform}));
async function flow(name,fn,options={}){const c=await browser.newContext({viewport:{width:1440,height:960},reducedMotion:'reduce',...options});const p=await c.newPage();p.setDefaultTimeout(6000);p.on('pageerror',e=>report.errors.push({name,message:e.message}));await c.route('**/*',r=>{if(new URL(r.request().url()).origin===url)return r.continue();report.externalRequests.push(r.request().url());r.abort();});try{await p.goto(url,{waitUntil:'networkidle'});await p.locator('.home-copy').waitFor();const result=await fn(p,c);report.checks.push({name,status:'PASS',result});console.log('PASS '+name);}catch(e){report.checks.push({name,status:'FAIL',error:e.message});await shot(p,name+'-failure');console.log('FAIL '+name+': '+e.message);}finally{await c.close();}}
async function main(){
 report.hashes={};for(const name of ['index.html','app.js','styles.css']){const bytes=fs.readFileSync(path.join(src,name));report.hashes[name]=crypto.createHash('sha256').update(bytes).digest('hex');const r=await fetch(url+'/'+name);assert.equal(r.status,200);assert.ok(bytes.equals(Buffer.from(await r.arrayBuffer())));}
 browser=await chromium.launch({channel:'chrome',headless:true});report.browser=browser.version();
 await flow('home-side-drag',async p=>{
  await shot(p,'home-unchanged');await click(p,'home-demo');await p.waitForFunction(()=>!document.querySelector('.demo-next').disabled);
  const r=await p.locator('#home-book').boundingBox();
  await p.mouse.move(r.x+r.width*.96,r.y+r.height*.5);await p.mouse.down();await p.mouse.move(r.x+r.width*.52,r.y+r.height*.5,{steps:18});await shot(p,'home-side-midturn');
  assert.equal(await p.locator('.side-strip').count(),40);assert.equal(await p.locator('.side-strip').first().evaluate(e=>e.style.clipPath),'');
  await p.mouse.up();await p.waitForFunction(()=>document.querySelector('.demo-progress').textContent.includes('03'));await click(p,'home-prev');await p.waitForFunction(()=>document.querySelector('.demo-progress').textContent.includes('01'));
  return {middleEdgeWorks:true,verticalStrips:40,forwardAndBack:true};
 },{reducedMotion:'no-preference'});
 await flow('book-side-cancel-and-back',async p=>{
  await p.locator('[data-action="nav"][data-view="shelf"]').click();await A(p,'open-book').click();const r=await p.locator('.reader-spread').boundingBox();
  await drag(p,{x:r.x+r.width*.96,y:r.y+r.height*.4},{x:r.x+r.width*.9,y:r.y+r.height*.4});await p.waitForFunction(()=>!document.querySelector('.reader-turn-layer'));assert.equal(await p.locator('[data-reader-page="0"]').count(),1);
  await p.mouse.move(r.x+r.width*.96,r.y+r.height*.5);await p.mouse.down();await p.mouse.move(r.x+r.width*.36,r.y+r.height*.5,{steps:20});await shot(p,'book-side-backface');assert.equal(await p.locator('.reader-turn-layer.soft-home-turn .side-strip').count(),40);assert.equal(await p.locator('.reader-turn-layer').evaluate(e=>getComputedStyle(e).perspective),'2400px');assert.ok(await p.locator('.side-back [data-reader-page="1"]').count()>0);await p.mouse.up();await p.waitForFunction(()=>!document.querySelector('.reader-turn-layer'));assert.equal(await p.locator('.reader-spread > [data-reader-page="1"]').count(),1);
  return {cancelPreservesPage:true,differentBackFace:true,sideDragCommits:true};
 },{reducedMotion:'no-preference'});
 await flow('editing-side-turn',async p=>{
  const id=await newBook(p,'编辑侧翻');await text(p,'第一页原文');await click(p,'page-add');await text(p,'第二页原文');const before=(await saved(p)).books.find(b=>b.id===id).pages;
  await click(p,'page-prev');await p.locator('.editing-turn-layer .side-strip').first().waitFor();assert.equal(await p.locator('.editing-turn-layer.soft-home-turn .side-strip').count(),40);await p.waitForTimeout(650);await shot(p,'editing-side-turn');await p.waitForFunction(()=>!document.querySelector('.editing-turn-layer'));await p.locator('#canvas-page').getByText('第一页原文').waitFor();assert.equal(await p.locator('#canvas-page').evaluate(e=>e.closest('.page-frame').inert),false);
  assert.deepEqual((await saved(p)).books.find(b=>b.id===id).pages,before);
  await p.locator('#canvas-page .text').dblclick();await p.locator('#text-content').waitFor();return {savedBeforeTurn:true,pageContentUnchanged:true,editableAfterTurn:true};
 },{reducedMotion:'no-preference'});
 await flow('scissors-freehand-auto-preview',async p=>{
  await click(p,'home-create-sticker');await p.locator('#photo-input').setInputFiles(path.join(src,'assets/lake.jpg'));await p.locator('.scissors-mode').waitFor();assert.equal(await p.locator('.scissors-mode').count(),1);const r=await p.locator('#crop-stage').boundingBox();
  await p.mouse.move(r.x+r.width*.22,r.y+r.height*.2);await p.mouse.down();
  for(const [x,y] of [[.7,.22],[.55,.5],[.75,.8],[.25,.75],[.22,.2]])await p.mouse.move(r.x+r.width*x,r.y+r.height*y,{steps:10});
  await p.locator('.scissor-loupe').waitFor();await shot(p,'scissors-loupe');await p.mouse.up();await p.locator('#sticker-preview').waitFor();
  const alpha=await p.locator('#sticker-preview').evaluate(async el=>{await el.decode();const c=document.createElement('canvas');c.width=el.naturalWidth;c.height=el.naturalHeight;const x=c.getContext('2d');x.drawImage(el,0,0);const d=x.getImageData(0,0,c.width,c.height).data;let clear=0,solid=0;for(let i=3;i<d.length;i+=4){if(!d[i])clear++;if(d[i]===255)solid++;}return {clear,solid};});assert.ok(alpha.clear>100&&alpha.solid>100);await shot(p,'scissors-result');await click(p,'save-and-use');await p.locator('.creation-books').waitFor();assert.equal((await saved(p)).assets.length,1);return {autoPreview:true,alpha,localOnly:true};
 });
 await flow('scissors-point-by-point',async p=>{
  await click(p,'home-create-sticker');await p.locator('#photo-input').setInputFiles(path.join(src,'assets/lake.jpg'));const r=await p.locator('#crop-stage').boundingBox();
  for(const [x,y] of [[.2,.2],[.8,.2],[.55,.75]])await p.mouse.click(r.x+r.width*x,r.y+r.height*y);
  await click(p,'undo-crop');assert.equal(await A(p,'finish-scissors').isDisabled(),true);await p.mouse.click(r.x+r.width*.5,r.y+r.height*.8);assert.equal(await A(p,'finish-scissors').isDisabled(),false);await shot(p,'scissors-click-outline');await click(p,'finish-scissors');await p.locator('#sticker-preview').waitFor();return {clickPoints:true,undoLastPoint:true,explicitCut:true};
 });
 await flow('rectangle-and-stale-photo',async p=>{
  await click(p,'home-create-sticker');await p.locator('#photo-input').setInputFiles(path.join(src,'assets/lake.jpg'));await click(p,'crop-mode','rect');const r=await p.locator('#crop-stage').boundingBox();await drag(p,{x:r.x+r.width*.2,y:r.y+r.height*.2},{x:r.x+r.width*.7,y:r.y+r.height*.7});await p.locator('#crop-stage').waitFor();assert.equal(await p.locator('#sticker-preview').count(),0);await click(p,'generate');await p.locator('#sticker-preview').waitFor();return {rectangleStillAvailable:true};
 });
 await flow('mobile-soft-edge-drag',async(p,c)=>{
  await p.locator('[data-action="nav"][data-view="shelf"]').click();await A(p,'open-book').click();await p.locator('.reader-spread.single').waitFor();
  const before=await saved(p),r=await p.locator('.reader-spread').boundingBox(),cdp=await c.newCDPSession(p);
  const touch=(type,x)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y:r.y+r.height*.5}]});
  await touch('touchStart',r.x+r.width*.96);
  for(let i=1;i<=20;i++)await touch('touchMove',r.x+r.width*(.96-.9*i/20));
  assert.equal(await p.locator('.reader-turn-layer.soft-home-turn .side-strip').count(),40);
  await p.screenshot({path:path.join(out,'mobile-soft-middle.png')});report.screenshots.push('mobile-soft-middle.png');
  await touch('touchEnd');await p.waitForFunction(()=>!document.querySelector('.reader-turn-layer'));
  assert.equal(await p.locator('.reader-spread > [data-reader-page="1"]').count(),1);
  await click(p,'page-prev');await p.waitForFunction(()=>!document.querySelector('.reader-turn-layer'));
  assert.equal(await p.locator('.reader-spread > [data-reader-page="0"]').count(),1);
  const after=await saved(p);assert.deepEqual(after.books.map(b=>b.pages),before.books.map(b=>b.pages));
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),390);
  return {actualSimulatedTouchDrag:true,softStrips:40,frontBack:true,pageContentUnchanged:true,physicalDevice:false};
 },{viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'no-preference'});
 await flow('mobile-scissors-and-side',async(p,c)=>{
  await click(p,'home-create-sticker');await p.locator('#photo-input').setInputFiles(path.join(src,'assets/lake.jpg'));const r=await p.locator('#crop-stage').boundingBox();
  for(const [x,y] of [[.15,.15],[.85,.2],[.65,.8],[.25,.7]])await p.touchscreen.tap(r.x+r.width*x,r.y+r.height*y);await click(p,'finish-scissors');await p.locator('#sticker-preview').waitFor();await click(p,'save-stickers');await p.locator('[data-action="nav"][data-view="shelf"]').click();await A(p,'open-book').click();await click(p,'page-next');await p.waitForFunction(()=>!document.querySelector('.reader-turn-layer'));assert.equal(await p.locator('.reader-spread > [data-reader-page="1"]').count(),1);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),390);await shot(p,'mobile-side-result');return {touchPointCut:true,mobileSinglePage:true,noHorizontalOverflow:true,physicalDevice:false};
 },{viewport:{width:390,height:844},isMobile:true,hasTouch:true});
}
main().catch(e=>{report.fatal=e.stack;console.error(e);}).finally(async()=>{await browser?.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({out,pass:report.checks.filter(c=>c.status==='PASS').length,fail:report.checks.filter(c=>c.status==='FAIL').length,errors:report.errors,fatal:report.fatal}));process.exitCode=report.fatal||report.checks.some(c=>c.status==='FAIL')||report.errors.length?1:0;});
