const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('/Users/song/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const label=process.argv[2];if(!/^[a-z0-9-]+$/.test(label||''))throw Error('Unique output label required');const out=path.join(__dirname,label);fs.mkdirSync(out);
const base='http://127.0.0.1:4176',report={checks:[],errors:[],external:[],writes:[],network:[]};let browser;
const a=(p,name)=>p.locator(`[data-action="${name}"]`).first();
async function photo(p,file='coffee.jpg'){
 await a(p,'home-create-sticker').click();await p.locator('#photo-input').setInputFiles(path.resolve(__dirname,'../../shiye-editorial-prototype/assets',file));
 await p.waitForFunction(()=>document.querySelector('#crop-source')?.naturalWidth>0);
}
async function rect(p){await p.locator('#crop-stage').scrollIntoViewIfNeeded();return p.evaluate(()=>{const g=cropGeometry();return{x:g.rect.left+g.left,y:g.rect.top+g.top,w:g.width,h:g.height};});}
async function polygon(p,points){
 await p.locator('[data-action="crop-mode"][data-value="outline"]').click();
 for(const [x,y]of points){const r=await rect(p);await p.mouse.click(r.x+r.w*x,r.y+r.h*y);}
 await a(p,'finish-scissors').click();
}
async function seed(p,kind,x,y){await a(p,'edge-'+kind).click();const r=await rect(p);await p.mouse.click(r.x+r.w*x,r.y+r.h*y);}
async function run(p){await a(p,'edge-run').click();await p.waitForFunction(()=>document.querySelector('.edge-mask')&& !document.querySelector('[data-action="edge-confirm"]').disabled,null,{timeout:25000});}
async function flow(name,fn,options={}){
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',...options}),p=await context.newPage();p.setDefaultTimeout(8000);
 p.on('pageerror',e=>report.errors.push(e.message));
 await context.route('**/*',r=>{
  const q=r.request(),url=new URL(q.url());if(url.protocol==='data:'||url.protocol==='blob:')return r.continue();
  if(url.origin!==base){report.external.push(url.origin);return r.abort();}
  if(!['GET','HEAD'].includes(q.method())){report.writes.push(url.pathname);return r.abort();}
  report.network.push(url.pathname);return r.continue();
 });
 try{await p.goto(base,{waitUntil:'networkidle'});await fn(p);report.checks.push({name,status:'PASS'});console.log('PASS',name);}
 catch(e){report.checks.push({name,status:'FAIL',error:e.message});await p.screenshot({path:path.join(out,name+'-failure.png'),fullPage:true});console.log('FAIL',name,e.message);}
 finally{await context.close();}
}
(async()=>{
 browser=await chromium.launch({channel:'chrome',headless:true});
 await flow('real-worker-corrections-save-and-reload',async p=>{
  await photo(p);await polygon(p,[[.35,.115],[.62,.115],[.62,.465],[.35,.465]]);await a(p,'edge-enable').click();await run(p);
  assert.equal(await a(p,'generate').isVisible(),false);assert.equal(await p.locator('#sticker-preview').count(),0);
  const initial=await p.locator('.edge-mask').getAttribute('src');
  await seed(p,'keep',.49,.29);await seed(p,'remove',.35,.22);await seed(p,'remove',.58,.44);
  assert.equal(await p.locator('.edge-seed').count(),3);assert.equal(await a(p,'edge-confirm').isDisabled(),true);await run(p);
  assert.notEqual(await p.locator('.edge-mask').getAttribute('src'),initial);
  await p.screenshot({path:path.join(out,'desktop-correction.png'),fullPage:true});
  await a(p,'edge-undo').click();assert.equal(await p.locator('.edge-seed').count(),2);assert.equal(await a(p,'edge-confirm').isDisabled(),true);
  await a(p,'undo-crop').click();assert.equal(await p.locator('.edge-seed').count(),3);assert.equal(await a(p,'edge-confirm').isDisabled(),false);
  await a(p,'edge-confirm').click();await p.locator('#sticker-preview').waitFor();
  const pixels=await p.evaluate(async()=>{const i=document.querySelector('#sticker-preview');await i.decode();const c=document.createElement('canvas');c.width=i.naturalWidth;c.height=i.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(i,0,0);const d=ctx.getImageData(0,0,c.width,c.height).data;let clear=0,solid=0;for(let j=3;j<d.length;j+=4){if(!d[j])clear++;if(d[j]===255)solid++;}return{clear,solid,provenance:workshop.results[0].provenance};});
  assert.ok(pixels.clear>0&&pixels.solid>0);assert.equal(pixels.provenance.kind,'classical-segmentation');report.pixels=pixels;
  await p.screenshot({path:path.join(out,'transparent-preview.png'),fullPage:true});
  await a(p,'save-stickers').click();await p.waitForFunction(()=>currentView==='collection'&&saveStatus==='已保存到本机');
  const before=await p.evaluate(()=>({asset:structuredClone(state.assets.at(-1)),books:JSON.stringify(state.books)}));assert.equal(before.asset.provenance.algorithm,'opencv-grabcut-4.13.0');
  await p.reload({waitUntil:'networkidle'});const after=await p.evaluate(()=>({asset:structuredClone(state.assets.at(-1)),books:JSON.stringify(state.books)}));assert.deepEqual(after,before);
  await a(p,'home-create-sticker').click();await p.locator('[data-action="nav"][data-view="collection"]').click();await p.locator('[data-action="collection-tab"][data-value="mine"]').click();await a(p,'use-collected').click();await a(p,'creation-new-book').click();await p.locator('#new-title').fill('GrabCut 本机试验');await a(p,'create-book').click();await p.waitForFunction(()=>currentView==='editor'&&saveStatus==='已保存到本机');const book=await p.evaluate(()=>structuredClone(currentBook()));assert.equal(book.pages[0].elements.length,1);assert.equal(book.pages[0].elements[0].assetId,before.asset.id);await p.screenshot({path:path.join(out,'creation-destination.png'),fullPage:true});await p.reload({waitUntil:'networkidle'});assert.equal(await p.evaluate(id=>state.books.find(b=>b.id===id).pages[0].elements.length,book.id),1);
 });
 await flow('multiple-regions-and-stale-result-protection',async p=>{
  await photo(p);await polygon(p,[[.35,.115],[.62,.115],[.62,.465],[.35,.465]]);await a(p,'edge-enable').click();await run(p);
  await polygon(p,[[.5,.4],[.76,.4],[.76,.77],[.5,.77]]);assert.equal(await a(p,'edge-confirm').isDisabled(),true);
  await run(p);await a(p,'edge-confirm').click();assert.equal(await p.evaluate(()=>workshop.results.length),2);
  await a(p,'back-subjects').click();await a(p,'edge-range').click();await p.locator('.crop-vertex').first().focus();await p.keyboard.press('ArrowLeft');
  assert.equal(await a(p,'edge-confirm').isDisabled(),true);await a(p,'undo-crop').click();assert.equal(await a(p,'edge-confirm').isDisabled(),false);
  await a(p,'edge-run').click();await a(p,'edge-cancel').click();assert.ok((await p.locator('#edge-status').innerText()).includes('已取消'));
  await a(p,'edge-run').click();await a(p,'workshop-reset').click();await p.locator('#upload-zone').waitFor();await p.waitForTimeout(800);
  assert.equal(await p.locator('.edge-mask').count(),0);assert.equal(await p.evaluate(()=>workshop.step),0);
 });
 await flow('mobile-points-and-layout',async p=>{
  await photo(p);await polygon(p,[[.35,.115],[.62,.115],[.62,.465],[.35,.465]]);await a(p,'edge-enable').click();
  await seed(p,'keep',.49,.29);assert.equal(await p.locator('.edge-seed').count(),1);await run(p);
  await p.locator('#crop-stage').scrollIntoViewIfNeeded();const aligned=await p.evaluate(()=>{const g=cropGeometry(),m=document.querySelector('.edge-overlay').getBoundingClientRect();return Math.abs(m.left-g.rect.left-g.left)<2&&Math.abs(m.width-g.width)<2;});assert.equal(aligned,true);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),390);await p.screenshot({path:path.join(out,'mobile-correction.png'),fullPage:true});
  await a(p,'edge-confirm').click();await p.locator('#sticker-preview').waitFor();
 },{viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.external,[]);assert.deepEqual(report.writes,[]);
})().catch(e=>{report.fatal=e.message;}).finally(async()=>{await browser?.close();report.network=[...new Set(report.network)];fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));process.exitCode=report.fatal||report.checks.some(c=>c.status!=='PASS')?1:0;});
