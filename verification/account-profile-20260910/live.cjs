const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('/Users/song/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const runtime='.local/baidu-live-trial-20260908',backup='.local/account-profile-backup-20260910';
 for(const name of ['admin.json','invites.json'])assert.equal(fs.readFileSync(runtime+'/'+name,'utf8'),fs.readFileSync(backup+'/'+name,'utf8'));
 const base='http://127.0.0.1:4176',browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:390,height:900},isMobile:true,hasTouch:true});await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base,{waitUntil:'networkidle'});await page.locator('[data-action="access-open"]').click();await page.locator('[data-value="account"]').click();await page.locator('#account-form').waitFor();await page.screenshot({path:path.join(__dirname,'live-entry.png'),fullPage:true});
  assert.equal((await context.request.get(base+'/api/account')).status(),401);assert.equal((await context.request.get(base+'/api/admin/overview')).status(),403);assert.equal((await context.request.get(base+'/account-ui.js')).status(),200);
  const health=await(await context.request.get(base+'/api/health')).json();assert.equal(health.mode,'live');assert.equal(health.limitsDisabled,true);assert.deepEqual(errors,[]);
  const result={status:'PASS',scope:'live public entry, private configuration preservation and anonymous access checks',accountAndInvitesUnchanged:true,profileScriptServed:true,anonymousAccountDenied:true,anonymousAdminDenied:true,realAccountLogin:'Not attempted: retained current user-set password; full account flows verified with isolated accounts',providerCalls:0};fs.writeFileSync(path.join(__dirname,'live-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
