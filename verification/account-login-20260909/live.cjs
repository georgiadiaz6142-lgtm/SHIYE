const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('/Users/song/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const runtime='.local/baidu-live-trial-20260908',backup='.local/account-login-backup-20260909',before=JSON.parse(fs.readFileSync(backup+'/admin.json','utf8')),after=JSON.parse(fs.readFileSync(runtime+'/admin.json','utf8'));
 assert.match(after.accountId,/^[a-f0-9-]{36}$/);assert.equal(after.role,'admin');assert.equal(after.username,before.username);assert.equal(after.passwordHash,before.passwordHash);assert.equal(after.salt,before.salt);assert.deepEqual(after.apis,before.apis);assert.equal(fs.readFileSync(runtime+'/invites.json','utf8'),fs.readFileSync(backup+'/invites.json','utf8'));
 const base='http://127.0.0.1:4176',browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:950}});await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base,{waitUntil:'networkidle'});await page.locator('[data-action="access-open"]').click();await page.locator('[data-value="account"]').click();await page.locator('#account-username').fill(after.username);assert.equal(await page.locator('#account-password').getAttribute('type'),'password');await page.screenshot({path:path.join(__dirname,'live-entry.png'),fullPage:true});
  assert.equal((await context.request.post(base+'/api/access/login',{headers:{origin:base},data:{}})).status(),422);assert.equal((await context.request.get(base+'/api/admin/overview')).status(),403);
  await page.goto(base+'/admin',{waitUntil:'networkidle'});await page.locator('#login-form').waitFor();assert.deepEqual(errors,[]);
  const result={status:'PASS',scope:'live entry and account migration checks',username:after.username,fixedAccountIdPresent:true,passwordPreserved:true,apiConfigurationPreserved:true,invitationsPreserved:true,homepageAccountEntry:true,dedicatedEntry:true,anonymousAdminDenied:true,realAccountLogin:'Not attempted: current user-set password is private; complete flow tested with isolated accounts',externalRequests:0};fs.writeFileSync(path.join(__dirname,'live-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
