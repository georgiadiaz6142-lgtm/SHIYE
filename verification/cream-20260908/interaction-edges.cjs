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
 const baseline=JSON.parse(fs.readFileSync(path.join(__dirname,'interaction-baseline.json')));report.hashes={};for(const name of ['index.html','app.js','styles.css']){const bytes=fs.readFileSync(path.join(src,name)),hash=crypto.createHash('sha256').update(bytes).digest('hex');assert.equal(hash,baseline[name]);const res=await fetch(url+'/'+name);assert.equal(res.status,200);assert.ok(bytes.equals(Buffer.from(await res.arrayBuffer())));report.hashes[name]=hash;}
 browser=await chromium.launch({channel:'chrome',headless:true});report.browser=browser.version();

 for(const width of [320,390,700,1440])await flow('reading-layout-'+width,async p=>{
  await p.locator('[data-action="nav"][data-view="shelf"]').click();await A(p,'open-book').click();await p.locator('.reader-spread').waitFor();
  const boxes=await p.locator('.reader-stage .page-arrow,.reader-spread').evaluateAll(es=>es.map(e=>{const b=e.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,width:b.width};}));
  assert.ok(boxes.every(b=>b.left>=0&&b.right<=width+1));assert.ok(Math.abs((boxes[0].top+boxes[0].bottom)-(boxes[1].top+boxes[1].bottom))<3);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),width);await shot(p,'reading-layout-'+width);
  return {width,boxes};
 },{viewport:{width,height:844}});
 await flow('warehouse-short-swipe-scroll',async(p,c)=>{
  await newBook(p,'短滑动不添加');await click(p,'drawer','sticker');
  const b=await A(p,'insert-sticker').boundingBox(),client=await c.newCDPSession(p),x=b.x+b.width/2,y=b.y+b.height/2;
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:0}]});
  for(let i=1;i<=8;i++)await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-i*8,id:0}]});
  await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.ok(await p.locator('.drawer').evaluate(e=>e.scrollTop)>0);assert.equal(await p.locator('#canvas-page .element').count(),0);assert.equal(await p.locator('.sticker-drag-ghost').count(),0);
  return {scrolls:true,noAccidentalInsert:true};
 },{viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await flow('save-use-failure-retry',async p=>{
  await click(p,'home-create-sticker');await click(p,'sample');await click(p,'generate');
  await p.evaluate(()=>{const original=IDBObjectStore.prototype.put;window.restorePut=()=>IDBObjectStore.prototype.put=original;IDBObjectStore.prototype.put=function(){throw new DOMException('test quota','QuotaExceededError')};});
  await click(p,'save-and-use');await p.waitForFunction(()=>document.querySelector('.local-status')?.textContent==='保存失败，请重试');
  assert.equal(await p.locator('#sticker-preview').count(),1);assert.equal(await p.locator('.creation-books').count(),0);
  await p.evaluate(()=>window.restorePut());await click(p,'save-and-use');await p.locator('.creation-books').waitFor();
  assert.equal((await saved(p)).assets.length,2);await click(p,'close-dialog');assert.equal(await p.locator('#collection-results .sticker-card').count(),2);
  return {failedSaveDoesNotNavigate:true,retryNoDuplicates:true,cancelKeepsAssets:true};
 });
 await flow('viewport-change-cancels-fold',async p=>{
  await p.locator('[data-action="nav"][data-view="shelf"]').click();await A(p,'open-book').click();await p.locator('.reader-spread').waitFor();
  await click(p,'page-next');await p.locator('.reader-turn-layer').waitFor();await p.setViewportSize({width:390,height:844});
  await p.locator('.reader-spread.single').waitFor();assert.equal(await p.locator('.reader-turn-layer').count(),0);assert.equal(await p.locator('#canvas-page').count(),1);
  return {foldRemoved:true,mobileSinglePage:true};
 },{reducedMotion:'no-preference'});
}

main().catch(e=>{report.fatal=e.stack;console.error(e);}).finally(async()=>{await browser?.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({out,pass:report.checks.filter(c=>c.status==='PASS').length,fail:report.checks.filter(c=>c.status==='FAIL').length,errors:report.errors,fatal:report.fatal}));process.exitCode=report.fatal||report.checks.some(c=>c.status==='FAIL')||report.errors.length?1:0;});

