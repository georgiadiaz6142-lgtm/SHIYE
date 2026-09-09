const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),os=require('node:os');
const {pathToFileURL}=require('node:url');
const {chromium}=require('/Users/song/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {execFile}=require('node:child_process'),{promisify}=require('node:util');
const root=path.resolve(__dirname,'../..'), label=process.argv[2];if(!/^[a-z0-9-]+$/.test(label||''))throw Error('unique label required');
const out=path.join(__dirname,label);fs.mkdirSync(out);
const report={layer:'OFFLINE Baidu contract fixture + local HTTP + isolated browser; NOT real model validation',checks:[],errors:[],external:[]};
let browser,liveServer,mockServer,upstream=0;
const A=(p,a)=>p.locator(`[data-action="${a}"]`).first();
async function listen(app){const s=app.listen(0,'127.0.0.1');await new Promise((r,j)=>{s.once('listening',r);s.once('error',j);});return s;}
const base=s=>`http://127.0.0.1:${s.address().port}`;
async function shot(p,name){await p.screenshot({path:path.join(out,name+'.png'),fullPage:true});}
async function check(name,origin,fn,options={}){
 const ctx=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',...options}),p=await ctx.newPage();p.setDefaultTimeout(10000);
 p.on('pageerror',e=>report.errors.push(e.message));
 await ctx.route('**/*',r=>{const url=new URL(r.request().url());if(url.origin!==origin){report.external.push(url.origin);return r.abort();}return r.continue();});
 try{await p.goto(origin,{waitUntil:'networkidle'});assert.ok((await p.locator('body').innerText()).length>100);await fn(p);report.checks.push({name,status:'PASS'});console.log('PASS',name);}catch(e){report.checks.push({name,status:'FAIL',error:e.stack});await shot(p,name+'-fail');console.log('FAIL',name,e.message);}finally{await ctx.close();}
}
async function main(){
 const {createApp}=await import(pathToFileURL(path.join(root,'dist/server/app.js'))),{BaiduProvider}=await import(pathToFileURL(path.join(root,'dist/server/baidu.js'))),{fixture,mask}=await import(pathToFileURL(path.join(root,'dist/server/images.js')));
 const fakeFetch=async(url,init)=>{upstream++;if(String(url).endsWith('/token'))return Response.json({access_token:'offline-test-token',expires_in:3600});const body=JSON.parse(init.body);assert.equal(body.return_form,'mask');return Response.json({image:(await mask(body.method==='control'?1:0)).toString('base64'),log_id:String(1000+upstream)});};
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'shiye-baidu-browser-'));
 const live=await createApp({runtime:path.join(temp,'live'),staticRoot:path.join(root,'shiye-editorial-prototype'),mode:'live',ttl:600000,live:{provider:new BaiduProvider('offline-key','offline-secret',fakeFetch),maxCalls:10,approvedUntil:Date.now()+600000}});
 const mock=await createApp({runtime:path.join(temp,'mock'),staticRoot:path.join(root,'shiye-editorial-prototype'),latency:1});
 liveServer=await listen(live.app);mockServer=await listen(mock.app);browser=await chromium.launch({channel:'chrome',headless:true});
 const sample=await fixture();
 await check('mock-remains-off',base(mockServer),async p=>{
   await A(p,'home-create-sticker').click();await A(p,'seg-open').click();await p.waitForFunction(()=>!document.querySelector('[data-action="seg-start"]')?.disabled);
   assert.ok((await p.locator('.workshop-aside').innerText()).includes('百度真实测试尚未启用'));assert.equal(await p.locator('#seg-photo').count(),0);assert.equal(upstream,0);await shot(p,'mock-gate');
 });
 await check('baidu-photo-box-transparent-save-reload',base(liveServer),async p=>{
   await shot(p,'home');await A(p,'home-create-sticker').click();await A(p,'seg-open').click();await p.locator('#seg-photo').waitFor({state:'attached'});assert.equal(upstream,0);assert.equal(await A(p,'seg-upload').isDisabled(),true);
   await p.locator('#seg-photo').setInputFiles({name:'offline-fixture.png',mimeType:'image/png',buffer:sample});assert.equal(upstream,0);assert.equal(await A(p,'seg-upload').isDisabled(),true);
   await p.locator('#seg-consent').check();await A(p,'seg-upload').click();await p.waitForFunction(()=>document.querySelectorAll('.seg-candidate').length===1&&!document.querySelector('[data-action="seg-confirm"]').disabled);
   assert.equal(upstream,2);assert.equal(await p.locator('[data-tool="positive"]').count(),0);assert.ok((await p.locator('.seg-candidate').innerText()).includes('可能含多个物体'));
   await shot(p,'single-foreground-offline');
   const r=await p.locator('#seg-prompts').boundingBox();await p.mouse.move(r.x+r.width*.4,r.y+r.height*.1);await p.mouse.down();await p.mouse.move(r.x+r.width*.75,r.y+r.height*.8,{steps:8});await p.mouse.up();await A(p,'seg-refine').click();
   await p.waitForFunction(()=>document.querySelectorAll('.seg-candidate').length===2&&!document.querySelector('[data-action="seg-confirm"]').disabled);assert.equal(upstream,3);
   const ids=await p.locator('.seg-pick').evaluateAll(es=>es.map(e=>e.dataset.id));await A(p,'seg-target').click();
   const q=await p.locator('#seg-prompts').boundingBox();await p.mouse.move(q.x+q.width*.1,q.y+q.height*.1);await p.mouse.down();await p.mouse.move(q.x+q.width*.4,q.y+q.height*.8,{steps:8});await p.mouse.up();await A(p,'seg-refine').click();await p.waitForFunction(()=>!document.querySelector('[data-action="seg-confirm"]').disabled);
   assert.deepEqual(new Set(await p.locator('.seg-pick').evaluateAll(es=>es.map(e=>e.dataset.id))),new Set(ids));assert.equal(upstream,4);await shot(p,'box-candidates-offline');
   await A(p,'seg-confirm').click();await p.locator('#seg-sticker-preview').waitFor();await p.locator('#seg-border').fill('8');await p.waitForFunction(()=>document.querySelector('.range-label').textContent.includes('8px'));assert.equal(upstream,4);await shot(p,'transparent-offline');
   await A(p,'seg-save').click();await p.locator('.collection-header').waitFor();await p.waitForFunction(()=>document.querySelector('.local-status')?.textContent==='已保存到本机');
   const assets=await p.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('shiye-concept-v1',1);r.onsuccess=()=>{const db=r.result,q=db.transaction('data').objectStore('data').get('workspace');q.onsuccess=()=>{db.close();resolve(q.result.assets);};};}));assert.equal(assets.length,2);assert.ok(assets.every(a=>a.blobKey&&a.borderBaked&&a.provenance.provider==='baidu'&&a.provenance.mock===false&&a.provenance.providerRequestId));
   await p.reload({waitUntil:'networkidle'});await A(p,'home-create-sticker').click();await A(p,'seg-open').click();await p.waitForFunction(()=>document.querySelectorAll('.seg-candidate').length===2);assert.equal(upstream,4);
 });
 await check('mobile-box-coordinate-alignment',base(liveServer),async p=>{
   await A(p,'home-create-sticker').click();await A(p,'seg-open').click();await p.locator('#seg-photo').waitFor({state:'attached'});await p.locator('#seg-photo').setInputFiles({name:'offline-fixture.png',mimeType:'image/png',buffer:sample});await p.locator('#seg-consent').check();await A(p,'seg-upload').click();await p.waitForFunction(()=>document.querySelectorAll('.seg-candidate').length===1&&!document.querySelector('[data-action="seg-confirm"]').disabled);
   const img=await p.locator('#seg-source').boundingBox(),svg=await p.locator('#seg-prompts').boundingBox();assert.ok(Math.abs(img.width/img.height-1.5)<.02);assert.ok(Math.abs(img.height-svg.height)<1);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),390);await shot(p,'mobile-offline');
 },{viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await browser.close();browser=null;
 const regression=await promisify(execFile)(process.execPath,[path.join(root,'verification/stage1-20260908/http-browser.cjs'),'baidu-regression-'+label],{cwd:root,env:{...process.env,SHIYE_TEST_BASE:base(mockServer)},maxBuffer:1000000});
 fs.writeFileSync(path.join(out,'mock-regression.txt'),regression.stdout);report.checks.push({name:'existing-three-mock-HTTP-browser-flows',status:'PASS'});
}
main().catch(e=>{report.fatal=e.stack;console.error(e);}).finally(async()=>{await browser?.close();for(const s of [liveServer,mockServer])if(s)await new Promise(r=>s.close(r));report.offlineTransportRequests=upstream;fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));process.exitCode=report.fatal||report.errors.length||report.external.length||report.checks.some(c=>c.status==='FAIL')?1:0;});
