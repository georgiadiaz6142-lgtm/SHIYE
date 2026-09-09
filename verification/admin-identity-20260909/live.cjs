const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {scryptSync,timingSafeEqual}=require('node:crypto');
const {chromium}=require('/Users/song/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const base='http://127.0.0.1:4176',receipt=fs.readFileSync(path.resolve('.local/admin-account.txt'),'utf8'),username=receipt.match(/^用户名：(.+)$/m)[1],password=receipt.match(/^密码：(.+)$/m)?.[1];assert.equal(username,'宋静雯');
 const account=JSON.parse(fs.readFileSync('.local/baidu-live-trial-20260908/admin.json','utf8'));assert.equal(account.username,username);const initialPasswordCurrent=!!password&&timingSafeEqual(scryptSync(password,account.salt,64),Buffer.from(account.passwordHash,'hex'));
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:950}});await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const denied=(await context.request.get(base+'/api/admin/overview')).status();assert.equal(denied,403);
  await page.goto(base+'/admin',{waitUntil:'networkidle'});
  if(!initialPasswordCurrent){
   await page.locator('#login-form').waitFor();assert.equal(await page.locator('.stats').count(),0);
   for(const route of ['overview','invites','apis','audit'])assert.equal((await context.request.get(base+'/api/admin/'+route)).status(),403);
   await page.screenshot({path:path.join(__dirname,'live-login.png'),fullPage:true});
   await page.goto(base,{waitUntil:'networkidle'});await page.locator('[data-action="home-create-sticker"]').click();await page.locator('#invite-form').waitFor();assert.equal(await page.locator('[data-view="admin"]').count(),0);assert.deepEqual(errors,[]);
   const result={status:'PARTIAL',username,anonymousDenied:true,ordinaryEntryHidden:true,loginPageLoaded:true,administratorLogin:'Not retried: user changed the initial password; current password hash preserved',externalRequests:0};fs.writeFileSync(path.join(__dirname,'live-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));return;
  }
  await page.locator('[name="username"]').fill('admin');await page.locator('[name="password"]').fill(password);await page.locator('#login-form button').click();await page.waitForFunction(()=>document.querySelector('.error')?.textContent.includes('不正确'));
  await page.locator('[name="username"]').fill(username);await page.locator('#login-form button').click();await page.locator('.stats').waitFor();assert.ok((await page.locator('.topbar').innerText()).includes(username));
  const overview=await (await context.request.get(base+'/api/admin/overview')).json();assert.equal(overview.total,10);
  await page.goto(base,{waitUntil:'networkidle'});await page.locator('[data-action="home-create-sticker"]').click();await page.locator('[data-view="admin"]').waitFor();assert.ok((await page.locator('.profile-name').innerText()).includes(username));
  await page.screenshot({path:path.join(__dirname,'live-admin.png'),fullPage:true});
  await page.locator('[data-view="admin"]').click();await page.locator('[data-action="logout"]').click();await page.locator('#login-form').waitFor();assert.equal((await context.request.get(base+'/api/admin/overview')).status(),403);assert.deepEqual(errors,[]);
  const result={status:'PASS',username,oldUsernameRejected:true,anonymousDenied:true,adminEntryVisible:true,logoutDenied:true,inviteCount:overview.total,apis:overview.apis.map(a=>({kind:a.kind,enabled:a.enabled})),externalRequests:0};fs.writeFileSync(path.join(__dirname,'live-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
