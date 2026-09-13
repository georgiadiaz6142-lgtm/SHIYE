const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('/Users/song/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,process.argv[2]||'run-01');fs.mkdirSync(out);let browser,server;const results=[];
(async()=>{
 const {createApp}=await import(path.join(root,'dist/server/app.js')),{Fault}=await import(path.join(root,'dist/shared/contracts.js')),{fixture,mask}=await import(path.join(root,'dist/server/images.js'));
 let calls=0;const {app,jobs}=await createApp({runtime:fs.mkdtempSync(path.join(os.tmpdir(),'shiye-cutout-errors-')),staticRoot:path.join(root,'shiye-editorial-prototype'),mode:'live',ttl:60000,latency:0,live:{maxCalls:null,approvedUntil:null,provider:{segment:async()=>{calls++;throw new Fault(502,'PROVIDER_TIMEOUT','等待百度图片处理响应超过 30 秒。处理和计费状态未知，不会自动重试；请联系管理员核对调用记录。');}}}});
 server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({channel:'chrome',headless:true});
 for(const width of [1440,390]){
  const ctx=await browser.newContext({viewport:{width,height:900},isMobile:width<500,hasTouch:width<500});await ctx.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());await ctx.route('**/api/access/session',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({available:true,authorized:true})}));const p=await ctx.newPage();p.setDefaultTimeout(10000);const errors=[];p.on('pageerror',e=>errors.push(e.message));let uploads=0;p.on('request',r=>{if(r.url().endsWith('/api/uploads/photo'))uploads++;});
  try{
   await p.goto(base,{waitUntil:'networkidle'});await p.locator('[data-action="home-create-sticker"]').click();await p.locator('[data-shelf-create-sticker]').click();await p.locator('[data-action="seg-open"]').click();await p.locator('#seg-photo').waitFor({state:'attached'});
   const dialog=p.locator('.seg-failure-dialog');
   await p.locator('#seg-photo').setInputFiles({name:'too-large.png',mimeType:'image/png',buffer:Buffer.alloc(10*1024*1024+1)});await dialog.waitFor();assert.match(await dialog.innerText(),/10 MB/);assert.equal(uploads,0);await dialog.getByRole('button',{name:'知道了'}).click();
   await p.locator('#seg-photo').setInputFiles({name:'bad.png',mimeType:'image/png',buffer:Buffer.from('invalid')});await dialog.waitFor();assert.match(await dialog.innerText(),/无法读取/);await p.keyboard.press('Escape');
   const file={name:'fixture.png',mimeType:'image/png',buffer:await fixture()};await p.locator('#seg-photo').setInputFiles(file);await p.locator('#seg-source').waitFor();
   // Server-side encoded size failure is surfaced, while original photo stays available.
   await p.route('**/api/uploads/photo',r=>r.fulfill({status:413,contentType:'application/json',body:JSON.stringify({error:{errorType:'PROVIDER_IMAGE_LIMIT',message:'图片转换并编码后超过百度 10 MB 限制；请降低分辨率后重新选择。'}})}));
   await p.locator('[data-action="seg-upload"]').click();await dialog.waitFor();assert.match(await dialog.innerText(),/编码后/);await dialog.getByRole('button').click();assert.ok(await p.locator('#seg-source').getAttribute('src'));await p.unroute('**/api/uploads/photo');
   const before=calls;await p.locator('[data-action="seg-upload"]').click();await dialog.waitFor();assert.match(await dialog.innerText(),/百度处理超时/);assert.equal(calls,before+1);const source=await p.locator('#seg-source').getAttribute('src');
   const box=await dialog.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width);await p.screenshot({path:path.join(out,'timeout-'+width+'.png'),fullPage:true});
   await dialog.getByRole('button').click();assert.equal(await p.locator('#seg-source').getAttribute('src'),source);await p.locator('[data-action="seg-restore"]').click();await p.waitForFunction(()=>!document.querySelector('[data-action="seg-restore"]')?.disabled);assert.equal(await dialog.count(),0);assert.equal(calls,before+1);assert.match(await p.locator('.seg-error').innerText(),/超过 30 秒/);
   // Reload restores the failed job and explains it once in the new visit, without re-submitting.
   await p.reload({waitUntil:'networkidle'});await p.locator('[data-action="home-create-sticker"]').click();await p.locator('[data-shelf-create-sticker]').click();await p.locator('[data-action="seg-open"]').click();await dialog.waitFor();assert.equal(calls,before+1);await dialog.getByRole('button').click();
   assert.deepEqual(errors,[]);results.push({width,status:'PASS',checks:['oversize before upload','invalid image','encoded limit keeps photo','async timeout dialog','dialog fits viewport','dismiss preserves photo','query deduplication and no retry','restore failed task']});
  }catch(e){results.push({width,status:'FAIL',error:e.stack});await p.screenshot({path:path.join(out,'failure-'+width+'.png'),fullPage:true}).catch(()=>{});}finally{await ctx.close();}
 }
 await jobs.idle();
})().catch(e=>results.push({status:'FAIL',error:e.stack})).finally(async()=>{await browser?.close();if(server)await new Promise(r=>server.close(r));fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results));if(results.some(r=>r.status==='FAIL'))process.exitCode=1;});
