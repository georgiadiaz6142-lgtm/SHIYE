const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require('/Users/song/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const label=process.argv[2];if(!/^[a-z0-9-]+$/.test(label||''))throw Error('unique label required');const out=path.join(__dirname,label);fs.mkdirSync(out);
const base='http://127.0.0.1:4176',report={checks:[],errors:[],external:[],screenshots:[],hashes:{}};let browser;
const a=(p,name,v)=>p.locator(`[data-action="${name}"]${v===undefined?'':`[data-value="${v}"]`}`).first();
async function shot(p,name){await p.screenshot({path:path.join(out,name+'.png'),fullPage:true});report.screenshots.push(name+'.png');}
async function ready(p){await a(p,'home-create-sticker').click();await a(p,'crop-example').click();await p.locator('#crop-source').waitFor();await p.waitForFunction(()=>document.querySelector('#crop-source')?.naturalWidth>0);}
async function imageRect(p){return p.evaluate(()=>{const g=cropGeometry();return{x:g.rect.left+g.left,y:g.rect.top+g.top,width:g.width,height:g.height};});}
async function saved(p){await p.waitForFunction(()=>document.querySelector('.local-status')?.textContent==='已保存到本机');return p.evaluate(()=>structuredClone(state));}
async function clickPoints(p){const r=await imageRect(p);for(const [x,y] of [[.2,.2],[.6,.25],[.55,.7],[.25,.65]])await p.mouse.click(r.x+r.width*x,r.y+r.height*y);}
async function flow(name,fn,options={}){
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',...options}),p=await context.newPage();p.setDefaultTimeout(7000);p.on('pageerror',e=>report.errors.push(e.message));
 await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():(report.external.push(r.request().url()),r.abort()));
 try{await p.goto(base,{waitUntil:'networkidle'});await fn(p);report.checks.push({name,status:'PASS'});console.log('PASS',name);}catch(e){report.checks.push({name,status:'FAIL',error:e.stack});console.log('FAIL',name,e.message);await shot(p,name+'-failure');}finally{await context.close();}
}
async function main(){
 for(const file of ['app.js','index.html','styles.css','selection.js','segmentation.css']){const bytes=fs.readFileSync(path.resolve(__dirname,'../../shiye-editorial-prototype',file)),response=await fetch(base+'/'+file);assert.equal(response.status,200);assert.ok(bytes.equals(Buffer.from(await response.arrayBuffer())));report.hashes[file]=crypto.createHash('sha256').update(bytes).digest('hex');}
 browser=await chromium.launch({channel:'chrome',headless:true});
 await flow('freehand-stays-editable-until-confirmed',async p=>{
  await ready(p);const r=await imageRect(p);await p.mouse.move(r.x+r.width*.2,r.y+r.height*.2);await p.mouse.down();
  for(const [x,y] of [[.6,.25],[.55,.7],[.25,.65],[.2,.2]])await p.mouse.move(r.x+r.width*x,r.y+r.height*y,{steps:9});await p.mouse.up();
  assert.equal(await p.locator('#crop-stage').count(),1);assert.equal(await p.locator('#sticker-preview').count(),0);assert.ok(await p.locator('.crop-vertex').count()>=3);await shot(p,'01-stays-on-photo');
  const before=await p.evaluate(()=>structuredClone(workshop.crops));const handle=p.locator('.crop-vertex').first(),b=await handle.boundingBox();await p.mouse.move(b.x+b.width/2,b.y+b.height/2);await p.mouse.down();await p.mouse.move(b.x+30,b.y+20,{steps:5});await p.mouse.up();
  const after=await p.evaluate(()=>structuredClone(workshop.crops));assert.notDeepEqual(after,before);await a(p,'undo-crop').click();assert.deepEqual(await p.evaluate(()=>workshop.crops),before);await a(p,'redo-crop').click();assert.deepEqual(await p.evaluate(()=>workshop.crops),after);
  await a(p,'generate').click();await p.locator('#sticker-preview').waitFor();const alpha=await p.evaluate(async()=>{const img=document.querySelector('#sticker-preview');await img.decode();const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);const d=ctx.getImageData(0,0,c.width,c.height).data;let clear=0,solid=0;for(let i=3;i<d.length;i+=4){if(d[i]===0)clear++;if(d[i]===255)solid++;}return{clear,solid};});assert.ok(alpha.clear>0&&alpha.solid>0);await shot(p,'02-explicit-preview');
  await a(p,'back-subjects').click();assert.deepEqual(await p.evaluate(()=>workshop.crops),after);
 });
 await flow('point-selection-clear-undo-keyboard-resize',async p=>{
  await ready(p);await clickPoints(p);assert.equal(await p.evaluate(()=>workshop.scissorPoints.length),4);await a(p,'undo-crop').click();assert.equal(await p.evaluate(()=>workshop.scissorPoints.length),3);await a(p,'redo-crop').click();assert.equal(await p.evaluate(()=>workshop.scissorPoints.length),4);
  await a(p,'finish-scissors').click();assert.equal(await p.locator('#crop-stage').count(),1);assert.equal(await p.evaluate(()=>workshop.crops.length),1);
  await a(p,'clear-crops').click();assert.equal(await p.evaluate(()=>workshop.crops.length),0);await a(p,'undo-crop').click();assert.equal(await p.evaluate(()=>workshop.crops.length),1);
  const before=await p.evaluate(()=>structuredClone(workshop.crops));await p.locator('.crop-vertex').first().focus();await p.keyboard.press('ArrowRight');assert.notDeepEqual(await p.evaluate(()=>workshop.crops),before);await a(p,'undo-crop').click();assert.deepEqual(await p.evaluate(()=>workshop.crops),before);
  await p.setViewportSize({width:1050,height:800});assert.deepEqual(await p.evaluate(()=>workshop.crops),before);await p.waitForFunction(()=>{const g=cropGeometry(),button=document.querySelector('.crop-vertex').getBoundingClientRect(),p=workshop.crops[0].points[0];return Math.abs(button.x+button.width/2-(g.rect.left+g.left+p.x*g.width))<2;});await shot(p,'03-adjusted-window');
  await a(p,'delete-crop').click();assert.equal(await p.evaluate(()=>workshop.crops.length),0);await a(p,'undo-crop').click();assert.equal(await p.evaluate(()=>workshop.crops.length),1);
 });
 await flow('confirmation-save-to-original-page-and-reload',async p=>{
  await p.locator('[data-action="nav"][data-view="shelf"]').click();await a(p,'new-book').click();await p.locator('#new-title').fill('剪刀确认回归');await a(p,'create-book').click();const book=(await saved(p)).books.find(b=>b.title==='剪刀确认回归');
  await a(p,'workshop-from-editor').click();await a(p,'crop-example').click();await p.locator('#crop-source').waitFor();await p.waitForFunction(()=>document.querySelector('#crop-source').naturalWidth>0);await clickPoints(p);
  await a(p,'generate').click();await p.locator('#sticker-preview').waitFor();await a(p,'save-and-use').click();await p.locator('#canvas-page').waitFor();let state=await saved(p);assert.equal(state.books.find(b=>b.id===book.id).pages[0].elements.length,1);assert.equal(state.assets.length,1);
  await p.reload({waitUntil:'networkidle'});await p.locator('[data-action="nav"][data-view="shelf"]').click();await p.locator(`[data-action="open-book"][data-id="${book.id}"]`).click();await p.locator('.read-mode').waitFor();state=await saved(p);assert.equal(state.books.find(b=>b.id===book.id).pages[0].elements.length,1);
 });
 await flow('mobile-taps-adjust-and-explicit-confirm',async p=>{
  await ready(p);const r=await imageRect(p);for(const [x,y]of[[.18,.2],[.65,.25],[.65,.75],[.18,.7]])await p.touchscreen.tap(r.x+r.width*x,r.y+r.height*y);
  await a(p,'finish-scissors').click();await p.locator('#crop-stage').scrollIntoViewIfNeeded();assert.equal(await p.locator('.crop-vertex').count(),4);assert.equal(await p.locator('#sticker-preview').count(),0);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),390);await shot(p,'04-mobile-adjust');await a(p,'generate').click();await p.locator('#sticker-preview').waitFor();
 },{viewport:{width:390,height:844},isMobile:true,hasTouch:true});
}
main().catch(e=>{report.fatal=e.stack;console.error(e);}).finally(async()=>{await browser?.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({out,...report}));process.exitCode=report.fatal||report.errors.length||report.checks.some(c=>c.status==='FAIL')?1:0;});
