const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('/Users/song/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const label=process.argv[2];if(!/^[a-z0-9-]+$/.test(label||''))throw Error('unique label required');const out=path.join(__dirname,label);fs.mkdirSync(out);
const base='http://127.0.0.1:4176',report={checks:[],errors:[],external:[],writes:[]};let browser;
const a=(p,name)=>p.locator(`[data-action="${name}"]`).first();
async function geometry(p){await p.locator('#crop-stage').scrollIntoViewIfNeeded();return p.evaluate(()=>{const g=cropGeometry();return{x:g.rect.left+g.left,y:g.rect.top+g.top,w:g.width,h:g.height};});}
async function choose(p){await a(p,'home-create-sticker').click();await p.locator('#photo-input').setInputFiles(path.resolve(__dirname,'../../shiye-editorial-prototype/assets/coffee.jpg'));await p.waitForFunction(()=>document.querySelector('#crop-source')?.naturalWidth>0);}
async function draw(p,coords=[[.35,.115],[.62,.115],[.62,.465],[.35,.465],[.35,.115]]){const g=await geometry(p);await p.mouse.move(g.x+g.w*coords[0][0],g.y+g.h*coords[0][1]);await p.mouse.down();for(const [x,y]of coords.slice(1))await p.mouse.move(g.x+g.w*x,g.y+g.h*y,{steps:6});await p.mouse.up();}
async function ready(p){await p.waitForFunction(()=>document.querySelector('.edge-mask')&&!document.querySelector('[data-action="edge-confirm"]').disabled,null,{timeout:25000});}
async function seed(p,kind,x,y){await a(p,'edge-'+kind).click();const g=await geometry(p);await p.mouse.click(g.x+g.w*x,g.y+g.h*y);}
async function shot(p,name){await p.screenshot({path:path.join(out,name+'.png'),fullPage:true});}
async function flow(name,fn,options={}){
 const c=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',...options}),p=await c.newPage();p.setDefaultTimeout(8000);
 await p.addInitScript(()=>{const Original=window.Worker;window.workerCount=0;window.Worker=class extends Original{constructor(...args){super(...args);window.workerCount++;}postMessage(...args){setTimeout(()=>super.postMessage(...args),250);}};});
 p.on('pageerror',e=>report.errors.push(e.message));await c.route('**/*',r=>{const q=r.request(),url=new URL(q.url());if(['data:','blob:'].includes(url.protocol))return r.continue();if(url.origin!==base){report.external.push(url.origin);return r.abort();}if(!['GET','HEAD'].includes(q.method())){report.writes.push(url.pathname);return r.abort();}return r.continue();});
 try{await p.goto(base,{waitUntil:'networkidle'});await fn(p,c);report.checks.push({name,status:'PASS'});console.log('PASS',name);}
 catch(e){report.checks.push({name,status:'FAIL',error:e.message});await shot(p,name+'-failure');console.log('FAIL',name,e.message);}
 finally{await c.close();}
}
(async()=>{
 browser=await chromium.launch({channel:'chrome',headless:true});
 await flow('auto-outline-correction-undo-next-save',async p=>{
  await choose(p);assert.equal(await a(p,'edge-enable').count(),0);assert.equal(await a(p,'edge-run').count(),0);assert.equal(await p.locator('.edge-more').getAttribute('open'),null);await shot(p,'desktop-start');
  await draw(p);await ready(p);assert.equal(await p.evaluate(()=>workerCount),1);assert.equal(await p.locator('#sticker-preview').count(),0);const original=await p.locator('.edge-mask').getAttribute('src');
  await seed(p,'remove',.49,.29);assert.equal(await p.locator('.edge-mask').getAttribute('src'),original);assert.equal(await a(p,'edge-confirm').isDisabled(),true);await ready(p);assert.equal(await p.evaluate(()=>workerCount),2);assert.notEqual(await p.locator('.edge-mask').getAttribute('src'),original);
  await a(p,'undo-crop').click();await ready(p);assert.equal(await p.locator('.edge-mask').getAttribute('src'),original);assert.equal(await p.evaluate(()=>workerCount),2);
  await seed(p,'keep',.49,.29);await ready(p);await seed(p,'remove',.35,.22);await ready(p);await shot(p,'desktop-result');
  const boxesBefore=await p.evaluate(()=>JSON.stringify(state.books));await a(p,'edge-confirm').click();await p.locator('#sticker-preview').waitFor();assert.equal(await p.evaluate(()=>state.assets.length),0);const first=await p.evaluate(()=>({...workshop.results[0]}));
  await a(p,'edge-next').click();await draw(p,[[.5,.4],[.76,.4],[.76,.77],[.5,.77],[.5,.4]]);await ready(p);await a(p,'edge-confirm').click();assert.equal(await p.evaluate(()=>workshop.results.length),2);assert.equal(await p.evaluate(()=>workshop.results[0].id),first.id);assert.equal(await p.evaluate(()=>workshop.results[0].src),first.src);
  await a(p,'save-and-use').click();await a(p,'creation-new-book').click();await p.locator('#new-title').fill('简化贴边验收');await a(p,'create-book').click();await p.waitForFunction(()=>currentView==='editor'&&saveStatus==='已保存到本机');
  const stateSaved=await p.evaluate(()=>({assets:state.assets.length,book:structuredClone(currentBook()),others:JSON.stringify(state.books.filter(b=>b.id!==activeBookId))}));assert.equal(stateSaved.assets,2);assert.equal(stateSaved.book.pages[0].elements.length,2);assert.equal(stateSaved.others,boxesBefore);
  await p.reload({waitUntil:'networkidle'});assert.equal(await p.evaluate(id=>state.books.find(b=>b.id===id).pages[0].elements.length,stateSaved.book.id),2);
 });
 await flow('cancel-change-photo-and-retry',async p=>{
  await choose(p);await draw(p);await ready(p);const image=await p.locator('.edge-mask').getAttribute('src');
  await seed(p,'remove',.5,.3);await a(p,'edge-cancel').click();assert.ok((await p.locator('#edge-status').innerText()).includes('已取消'));assert.equal(await p.locator('.edge-mask').getAttribute('src'),image);const calls=await p.evaluate(()=>workerCount);await p.waitForTimeout(700);assert.equal(await p.evaluate(()=>workerCount),calls);assert.equal(await a(p,'edge-confirm').isDisabled(),true);
  await a(p,'edge-run').click();await ready(p);await seed(p,'keep',.5,.3);await a(p,'workshop-reset').click();await p.locator('#upload-zone').waitFor();await p.waitForTimeout(600);assert.equal(await p.locator('.edge-mask').count(),0);assert.equal(await p.evaluate(()=>workshop.step),0);
 });
 await flow('failure-stops-auto-retry',async(p,c)=>{
  let failures=0;await c.route('**/edgecut-worker.js',r=>{failures++;return failures===1?r.abort():r.continue();});await choose(p);await draw(p);await a(p,'edge-run').waitFor();const calls=await p.evaluate(()=>workerCount);await p.waitForTimeout(700);assert.equal(await p.evaluate(()=>workerCount),calls);assert.equal(await a(p,'edge-confirm').isDisabled(),true);await a(p,'edge-run').click();await ready(p);assert.equal(failures,2);
 });
 await flow('manual-tool-remains-available',async p=>{
  await choose(p);await p.locator('.edge-more summary').click();await a(p,'edge-disable').click();assert.equal(await a(p,'generate').isVisible(),true);await draw(p);assert.equal(await p.evaluate(()=>workerCount),0);const before=await p.evaluate(()=>JSON.stringify(workshop.crops));await a(p,'undo-crop').click();await a(p,'redo-crop').click();assert.equal(await p.evaluate(()=>JSON.stringify(workshop.crops)),before);await a(p,'generate').click();await p.locator('#sticker-preview').waitFor();await a(p,'back-subjects').click();await a(p,'edge-enable').click();await ready(p);
 });
 await flow('mobile-tap-close-and-correction',async p=>{
  await choose(p);await shot(p,'mobile-start');
  for(const[x,y]of[[.35,.115],[.62,.115],[.62,.465],[.35,.465],[.35,.115]]){const g=await geometry(p);await p.touchscreen.tap(g.x+g.w*x,g.y+g.h*y);}await ready(p);assert.equal(await p.evaluate(()=>workerCount),1);
  await a(p,'edge-keep').click();let g=await geometry(p);await p.touchscreen.tap(g.x+g.w*.49,g.y+g.h*.29);await ready(p);assert.equal(await p.evaluate(()=>workerCount),2);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),390);await shot(p,'mobile-result');
  await p.setViewportSize({width:430,height:900});await p.waitForTimeout(100);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),430);
  const aligned=await p.evaluate(()=>{const g=cropGeometry(),m=document.querySelector('.edge-overlay').getBoundingClientRect();return Math.abs(m.left-g.rect.left-g.left)<2&&Math.abs(m.width-g.width)<2;});assert.equal(aligned,true);await a(p,'edge-confirm').click();await p.locator('#sticker-preview').waitFor();
 },{viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 assert.deepEqual(report.external,[]);assert.deepEqual(report.writes,[]);assert.deepEqual(report.errors,[]);
})().catch(e=>{report.fatal=e.message;}).finally(async()=>{await browser?.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));process.exitCode=report.fatal||report.checks.some(c=>c.status!=='PASS')?1:0;});
