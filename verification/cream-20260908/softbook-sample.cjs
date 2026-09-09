// Isolated Chrome: no connection to Song's browser profile or saved works.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require('/Users/song/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const src=path.resolve(__dirname,'../../shiye-editorial-prototype'),url='http://127.0.0.1:4176';
const out=path.join(__dirname,process.argv[2]||'softbook-sample-01');fs.mkdirSync(out,{recursive:true});
const report={checks:[],errors:[],screenshots:[],hashes:{}};let browser;
const shot=async(p,name)=>{await p.screenshot({path:path.join(out,name+'.png'),fullPage:!(/turn|middle/.test(name))});report.screenshots.push(name+'.png');};
const action=(p,a)=>p.locator(`[data-action="${a}"]`).first();
const idle=p=>p.waitForFunction(()=>!document.querySelector('.home-watch').disabled);
async function test(name,fn,options={}){
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'no-preference',...options});
 const p=await context.newPage();p.setDefaultTimeout(8000);p.on('pageerror',e=>report.errors.push(e.message));
 try{await p.goto(url,{waitUntil:'networkidle'});await p.locator('#home-title').waitFor();await fn(p,context);report.checks.push({name,status:'PASS'});console.log('PASS',name);}
 catch(e){report.checks.push({name,status:'FAIL',error:e.stack});console.log('FAIL',name,e.message);await shot(p,name+'-failure');}
 finally{await context.close();}
}
async function main(){
 for(const file of ['app.js','styles.css','index.html']){const bytes=fs.readFileSync(path.join(src,file)),res=await fetch(url+'/'+file);assert.equal(res.status,200);assert.ok(bytes.equals(Buffer.from(await res.arrayBuffer())));report.hashes[file]=crypto.createHash('sha256').update(bytes).digest('hex');}
 browser=await chromium.launch({channel:'chrome',headless:true});report.browser=browser.version();
 await test('desktop-forward-back-cancel',async p=>{
  await shot(p,'01-closed');await action(p,'home-demo').click();await idle(p);await shot(p,'02-open');
  const r=await p.locator('#home-book').boundingBox();
  await p.mouse.move(r.x+r.width*.96,r.y+r.height*.5);await p.mouse.down();
  for(const progress of [.15,.3,.5,.7,.88]){
   await p.mouse.move(r.x+r.width*(.96-progress),r.y+r.height*.5,{steps:12});
   assert.equal(await p.locator('.soft-home-turn .side-strip').count(),40);
   await shot(p,'03-turn-'+Math.round(progress*100));
  }
  await p.mouse.up();await idle(p);assert.match(await p.locator('.demo-progress').innerText(),/03 — 04/);
  assert.equal(await p.locator('.side-strip').count(),0);await shot(p,'04-second-spread');
  await p.mouse.move(r.x+r.width*.04,r.y+r.height*.5);await p.mouse.down();await p.mouse.move(r.x+r.width*.54,r.y+r.height*.5,{steps:20});await shot(p,'05-reverse-middle');await p.mouse.up();await idle(p);
  assert.match(await p.locator('.demo-progress').innerText(),/01 — 02/);
  await p.mouse.move(r.x+r.width*.96,r.y+r.height*.5);await p.mouse.down();await p.mouse.move(r.x+r.width*.9,r.y+r.height*.5,{steps:5});await p.mouse.up();await idle(p);
  assert.match(await p.locator('.demo-progress').innerText(),/01 — 02/);
  await action(p,'home-next').click();await idle(p);await action(p,'home-next').click();await idle(p);
  assert.match(await p.locator('.demo-progress').innerText(),/05 — 06/);assert.equal(await action(p,'home-next').isDisabled(),true);
  assert.equal(await p.locator('#home-book').evaluate(e=>e.style.getPropertyValue('--left-stack')),'6px');
  await action(p,'home-close').click();assert.equal(await p.locator('#home-book.is-open').count(),0);
 });
 await test('mobile-drag-and-layout',async(p,c)=>{
  await shot(p,'06-mobile-closed');await action(p,'home-demo').click();await idle(p);await p.locator('#home-book').scrollIntoViewIfNeeded();
  await p.waitForTimeout(250);
  await p.evaluate(()=>{window.touchTrace=[];for(const type of ['pointerdown','pointermove','pointerup','pointercancel','resize'])window.addEventListener(type,e=>window.touchTrace.push({type:e.type,x:e.clientX,y:e.clientY,button:e.button}));});
  const r=await p.locator('#home-book').boundingBox(),cdp=await c.newCDPSession(p);
  const touch=async(type,x)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y:r.y+r.height*.5}]});
  await touch('touchStart',r.x+r.width*.96);for(let i=1;i<=20;i++)await touch('touchMove',r.x+r.width*(.96-i*.025));
  report.mobileBeforeShot=await p.evaluate(()=>({strips:document.querySelectorAll('.side-strip').length,trace:window.touchTrace}));
  await shot(p,'07-mobile-middle');await touch('touchEnd');await idle(p);
  report.mobileAfterShot=await p.evaluate(()=>window.touchTrace);
  assert.match(await p.locator('.demo-progress').innerText(),/03 — 04/);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),390);await shot(p,'08-mobile-open');
 },{viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await test('reduce-motion-and-navigation',async p=>{
  await action(p,'home-demo').click();await idle(p);await action(p,'home-next').click();await idle(p);assert.equal(await p.locator('.side-strip').count(),0);
  await action(p,'home-create-sticker').click();await p.locator('#photo-input').waitFor({state:'attached'});assert.equal(await p.locator('#home-book').count(),0);
 },{reducedMotion:'reduce'});
 await test('navigation-during-turn',async p=>{
  await action(p,'home-demo').click();await idle(p);await action(p,'home-next').click();await p.locator('.soft-home-turn .side-strip').first().waitFor();
  await action(p,'home-create-sticker').click();await p.locator('#photo-input').waitFor({state:'attached'});await p.waitForTimeout(1700);assert.equal(await p.locator('#home-book').count(),0);
 });
 await test('resize-during-drag-and-keyboard',async p=>{
  await action(p,'home-demo').click();await idle(p);const r=await p.locator('#home-book').boundingBox();
  await p.mouse.move(r.x+r.width*.96,r.y+r.height*.5);await p.mouse.down();await p.mouse.move(r.x+r.width*.5,r.y+r.height*.5,{steps:10});
  await p.setViewportSize({width:1000,height:900});await p.waitForFunction(()=>!document.querySelector('.side-strip'));await p.mouse.up();await idle(p);
  assert.match(await p.locator('.demo-progress').innerText(),/01 — 02/);assert.equal(await p.locator('.side-strip').count(),0);
  await p.locator('#home-book').focus();await p.keyboard.press('ArrowRight');await idle(p);assert.match(await p.locator('.demo-progress').innerText(),/03 — 04/);
  await p.keyboard.press('ArrowLeft');await idle(p);await p.keyboard.press('Escape');assert.equal(await p.locator('#home-book.is-open').count(),0);
 });
}
main().catch(e=>{report.fatal=e.stack;console.error(e);}).finally(async()=>{await browser?.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({out,checks:report.checks,errors:report.errors,fatal:report.fatal}));process.exitCode=report.fatal||report.errors.length||report.checks.some(x=>x.status==='FAIL')?1:0;});
