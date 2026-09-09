const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require('/Users/song/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const sharp=require('/Users/song/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const label=process.argv[2];if(!/^[a-z0-9-]+$/.test(label||''))throw Error('unique output label required');
const out=path.join(__dirname,label);fs.mkdirSync(out);const base='http://127.0.0.1:4176';
const report={layer:'frontend API mocks only; not backend or model validation',checks:[],errors:[],external:[],screenshots:[]};let browser;
const A=(p,a)=>p.locator(`[data-action="${a}"]`).first();
async function shot(p,name){await p.screenshot({path:path.join(out,name+'.png'),fullPage:true});report.screenshots.push(name+'.png');}
async function workspace(p){await p.waitForFunction(()=>document.querySelector('.local-status')?.textContent==='已保存到本机');return p.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('shiye-concept-v1',1);r.onsuccess=()=>{const d=r.result,q=d.transaction('data').objectStore('data').get('workspace');q.onsuccess=()=>{d.close();resolve(q.result);};};}));}
async function flow(name,fn,options={}){
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',...options}),p=await context.newPage();p.setDefaultTimeout(7000);p.on('pageerror',e=>report.errors.push(e.message));
 const sid=crypto.randomUUID(),objectKey=crypto.randomUUID();let session=null,job=null,promptRequests=[];
 const source=await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#eee5d2"/><ellipse cx="155" cy="175" rx="80" ry="110" fill="#bd674e"/><path d="M310 65L410 150L365 285L255 210Z" fill="#6d8056"/><path d="M480 250L515 275L505 325L460 337L438 290Z" fill="#d3a249"/></svg>')).png().toBuffer();
 const png=await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="170" height="230"><ellipse cx="85" cy="115" rx="80" ry="110" fill="#bd674e"/></svg>')).png().toBuffer();
 function candidate(n){return {candidateId:crypto.randomUUID(),candidateRevision:1,imageSessionId:sid,sourceRevision:1,maskRef:crypto.randomUUID(),transparentRef:crypto.randomUUID(),boundingBox:{x:75,y:65,width:160,height:220},expiresAt:Date.now()+600000,name:'模拟形状 '+n,mock:true};}
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());if(url.origin!==base){report.external.push(url.origin);return route.abort();}
  const pathname=url.pathname;if(!pathname.startsWith('/api/'))return route.continue();
  const json=value=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(value)});
  if(pathname==='/api/health')return json({mode:'mock'});
  if(pathname==='/api/session')return json({session,job,mode:'mock'});
  if(pathname==='/api/uploads/photo/init'){session={imageSessionId:sid,objectKey,sourceRevision:1,width:600,height:400,candidates:[],promptRevision:0};return json(session);}
  if(pathname.startsWith('/api/media/'))return route.fulfill({status:200,contentType:'image/png',body:pathname.endsWith(objectKey)?source:png});
  if(pathname==='/api/segmentation/jobs'||pathname==='/api/segmentation/refine'){
   const input=route.request().postDataJSON(),kind=pathname.endsWith('refine')?'refine':'auto';
   let candidates=kind==='auto'?[candidate(1),candidate(2)]:[candidate(3)];
   if(kind==='refine'){
    promptRequests.push(input);if(input.targetCandidateId){candidates[0].candidateId=input.targetCandidateId;candidates[0].candidateRevision=input.candidateRevision+1;}
    session.promptRevision=input.promptRevision;
   }
   session.candidates=kind==='auto'?candidates:[...session.candidates.filter(c=>c.candidateId!==input.targetCandidateId),...candidates];
   job={jobId:crypto.randomUUID(),kind,status:'succeeded',input,candidates,mock:true};return json({...job,status:'queued'});
  }
  if(pathname.endsWith('/cancel')){job.status='cancelled';return json(job);}
  if(pathname.startsWith('/api/jobs/'))return json(job);
  return route.fulfill({status:404,body:'missing mock'});
 });
 try{await p.goto(base,{waitUntil:'networkidle'});await fn(p,{prompts:promptRequests});report.checks.push({name,status:'PASS'});console.log('PASS',name);}catch(e){report.checks.push({name,status:'FAIL',error:e.stack});console.log('FAIL',name,e.message);await shot(p,name+'-failure');}finally{await context.close();}
}
async function begin(p){await A(p,'home-create-sticker').click();await A(p,'seg-open').click();await A(p,'seg-start').click();await p.waitForFunction(()=>document.querySelectorAll('.seg-candidate').length===2);await p.waitForFunction(()=>!document.querySelector('[data-action="seg-confirm"]')?.disabled);}
async function main(){browser=await chromium.launch({channel:'chrome',headless:true});
 await flow('home-and-mock-refine-blob-save-reload',async(p,{prompts})=>{
  assert.ok((await p.locator('body').innerText()).includes('把日子'));await shot(p,'home');await begin(p);await shot(p,'candidates');
  await p.locator('[data-action="seg-tool"][data-tool="positive"]').click();const box=await p.locator('#seg-prompts').boundingBox();await p.mouse.click(box.x+box.width*.8,box.y+box.height*.73);await A(p,'seg-refine').click();
  await p.waitForFunction(()=>document.querySelectorAll('.seg-candidate').length===3);assert.ok(Math.abs(prompts[0].positivePoints[0].x-.8)<.01);
  await A(p,'seg-target').click();await p.locator('[data-action="seg-tool"][data-tool="outline"]').click();const r=await p.locator('#seg-prompts').boundingBox();
  await p.mouse.move(r.x+r.width*.12,r.y+r.height*.12);await p.mouse.down();await p.mouse.move(r.x+r.width*.4,r.y+r.height*.1,{steps:6});await p.mouse.move(r.x+r.width*.4,r.y+r.height*.8,{steps:10});await p.mouse.move(r.x+r.width*.12,r.y+r.height*.8,{steps:6});await p.mouse.up();await A(p,'seg-refine').click();
  await p.waitForFunction(()=>!document.querySelector('[data-action="seg-confirm"]')?.disabled);assert.ok(prompts[1].outlinePoints.length>=3);assert.equal(await p.locator('.seg-candidate').count(),3);
  await A(p,'seg-confirm').click();await p.locator('#seg-sticker-preview').waitFor();await p.locator('#seg-name').fill('模拟保存验证');await p.locator('#seg-name').blur();
  await p.locator('#seg-border').fill('8');await p.waitForFunction(()=>document.querySelector('.range-label')?.textContent.includes('8px'));await shot(p,'transparent-preview');
  await A(p,'seg-save').click();await p.locator('.collection-header').waitFor();const before=await workspace(p);assert.equal(before.assets.length,3);assert.ok(before.assets.every(a=>a.blobKey&&!a.src&&a.provenance.mock));
  assert.equal(await p.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('shiye-concept-v1',1);r.onsuccess=()=>{const db=r.result,q=db.transaction('data').objectStore('data').getAllKeys();q.onsuccess=()=>{db.close();resolve(q.result.filter(k=>String(k).startsWith('blob:')).length);};};})),3);
  await p.reload({waitUntil:'networkidle'});await p.locator('[data-action="nav"][data-view="shelf"]').click();await p.locator('[data-action="nav"][data-view="collection"]').first().click();await p.locator('[data-action="collection-tab"][data-value="mine"]').click();
  await p.waitForFunction(()=>[...document.querySelectorAll('.sticker-display img')].every(i=>i.complete&&i.naturalWidth>0));assert.equal((await workspace(p)).assets.length,3);await shot(p,'collection-restored');
 });
 await flow('source-page-save-failure-retry',async p=>{
  await p.locator('[data-action="nav"][data-view="shelf"]').click();await A(p,'new-book').click();await p.locator('#new-title').fill('模拟原页回填');await A(p,'create-book').click();const before=await workspace(p),book=before.books.find(b=>b.title==='模拟原页回填');
  await A(p,'workshop-from-editor').click();await A(p,'seg-open').click();await A(p,'seg-start').click();await p.waitForFunction(()=>document.querySelectorAll('.seg-candidate').length===2&&!document.querySelector('[data-action="seg-confirm"]').disabled);await A(p,'seg-confirm').click();
  await p.locator('#seg-sticker-preview').waitFor();await p.evaluate(()=>{window.testPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(){throw new DOMException('injected quota','QuotaExceededError');};});await A(p,'seg-use').click();
  await p.waitForFunction(()=>document.querySelector('.local-status')?.textContent==='保存失败，请重试');assert.equal(await p.locator('#seg-sticker-preview').count(),1);
  await p.evaluate(()=>IDBObjectStore.prototype.put=window.testPut);await A(p,'seg-use').click();await p.locator('#canvas-page').waitFor();const saved=await workspace(p),actual=saved.books.find(b=>b.id===book.id);assert.equal(actual.pages[0].id,book.pages[0].id);assert.equal(actual.pages[0].elements.length,2);assert.equal(saved.assets.length,2);
  await p.reload({waitUntil:'networkidle'});await p.locator('[data-action="nav"][data-view="shelf"]').click();await p.locator(`[data-action="open-book"][data-id="${book.id}"]`).click();await p.locator('.read-mode').waitFor();assert.equal((await workspace(p)).books.find(b=>b.id===book.id).pages[0].elements.length,2);
 });
 await flow('mobile-candidate-prompts-layout',async p=>{await begin(p);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),390);await p.locator('[data-action="seg-tool"][data-tool="positive"]').click();await p.locator('#seg-prompts').tap({position:{x:30,y:40}});await A(p,'seg-refine').click();await p.waitForFunction(()=>document.querySelectorAll('.seg-candidate').length===3);await shot(p,'mobile-candidates');},{viewport:{width:390,height:844},isMobile:true,hasTouch:true});
}
main().catch(e=>{report.fatal=e.stack;console.error(e);}).finally(async()=>{await browser?.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({out,...report}));process.exitCode=report.fatal||report.errors.length||report.checks.some(c=>c.status==='FAIL')?1:0;});
