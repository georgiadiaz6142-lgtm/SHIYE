const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('/Users/song/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base='http://127.0.0.1:4176',report={purpose:'Read-only live entry verification; no image selected or uploaded',checks:[],external:[],mutations:[],errors:[]};
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
  await context.route('**/*',route=>{
   const req=route.request();if(new URL(req.url()).origin!==base){report.external.push(new URL(req.url()).origin);return route.abort();}
   if(!['GET','HEAD'].includes(req.method())){report.mutations.push(new URL(req.url()).pathname);return route.abort();}
   return route.continue();
  });
  page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(base,{waitUntil:'networkidle'});
  const health=await page.evaluate(async()=>{const r=await fetch('/api/health');return r.json();});
  assert.equal(health.mode,'live');assert.equal(health.provider,'baidu');assert.equal(health.liveAvailable,true);assert.equal(health.localTtlSeconds,3600);report.health=health;
  await page.locator('[data-action="home-create-sticker"]').click();
  await page.locator('[data-action="seg-open"]').click();
  await page.locator('#seg-photo').waitFor({state:'attached'});
  assert.ok((await page.locator('.seg-notice').innerText()).includes('百度智能抠图'));
  assert.equal(await page.locator('#seg-consent').isChecked(),false);
  assert.equal(await page.locator('[data-action="seg-upload"]').isDisabled(),true);
  assert.equal(await page.locator('[data-action="seg-start"]').count(),0);
  await page.screenshot({path:path.join(__dirname,'live-entry.png'),fullPage:true});
  report.checks.push('live health confirmed','Baidu upload entry visible','consent unchecked; upload disabled until user chooses and confirms','mock start button absent');
  assert.deepEqual(report.external,[]);assert.deepEqual(report.mutations,[]);assert.deepEqual(report.errors,[]);
 }finally{await browser.close();}
})().catch(e=>{report.failure=e.message;process.exitCode=1;}).finally(()=>{fs.writeFileSync(path.join(__dirname,'live-entry-verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));});
