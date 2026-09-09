const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('/Users/song/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,process.argv[2]||'run-01');fs.mkdirSync(out);const results=[];let browser,server;
(async()=>{
 const {Admin}=await import(path.join(root,'dist/server/admin.js')),{InviteAccess,generateInvites}=await import(path.join(root,'dist/server/access.js')),{createApp}=await import(path.join(root,'dist/server/app.js'));
 browser=await chromium.launch({channel:'chrome',headless:true});
 for(const width of [1440,390,320]){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'shiye-account-')),batch=generateInvites(2),receipt=path.join(dir,'account.txt'),file=path.join(dir,'invites.json');fs.writeFileSync(file,JSON.stringify(batch.config));
  const access=new InviteAccess(file),admin=new Admin(path.join(dir,'admin.json'),access);await admin.init({apiKey:'test',secretKey:'test',cutout:false,naming:false},receipt);const password=fs.readFileSync(receipt,'utf8').match(/密码：(.+)/)[1];
  const data=JSON.parse(fs.readFileSync(admin.file,'utf8'));data.username='宋静雯';fs.writeFileSync(admin.file,JSON.stringify(data));
  const {app}=await createApp({runtime:path.join(dir,'runtime'),staticRoot:path.join(root,'shiye-editorial-prototype'),admin,access});server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port,contexts=[],errors=[];
  async function page(){const ctx=await browser.newContext({viewport:{width,height:950},isMobile:width<500,hasTouch:width<500});contexts.push(ctx);await ctx.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());const p=await ctx.newPage();p.setDefaultTimeout(10000);p.on('pageerror',e=>errors.push(e.message));return p;}
  async function open(p){await p.goto(base,{waitUntil:'networkidle'});await p.locator('[data-action="access-open"]').click();}
  async function account(p){await p.locator('[data-value="account"]').click();await p.locator('#account-username').fill('宋静雯');await p.locator('#account-password').fill(password);await p.locator('#account-form button').click();await p.locator('.sidebar [data-view="admin"]').waitFor();}
  let p;
  try{
   p=await page();await open(p);await p.locator('[data-value="phone"]').click();assert.equal(await p.locator('.access-phone input:enabled').count(),0);
   await p.locator('[data-value="account"]').click();await p.screenshot({path:path.join(out,'account-form-'+width+'.png'),fullPage:true});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),width);assert.ok(await p.locator('#dialog').evaluate(d=>d.scrollWidth<=d.clientWidth));
   await p.locator('#account-username').fill('宋静雯');await p.locator('#account-password').fill('wrong');await p.locator('#account-form button').click();await p.waitForFunction(()=>document.querySelector('#account-error')?.textContent.includes('不正确'));assert.equal(await p.locator('#account-password').inputValue(),'');assert.equal(await p.locator('[data-view="admin"]').count(),0);
   await p.locator('#account-password').fill('discard-on-close');await p.locator('[data-action="close-dialog"]').click();await p.locator('[data-action="access-open"]').click();await p.locator('[data-value="account"]').click();assert.equal(await p.locator('#account-password').inputValue(),'');
   await account(p);assert.ok((await p.locator('.profile-name').innerText()).includes('宋静雯'));await p.screenshot({path:path.join(out,'admin-shelf-'+width+'.png'),fullPage:true});const a=await (await p.context().request.get(base+'/api/access/session')).json();assert.equal(a.accountId,data.accountId);assert.equal((await access.snapshot()).invites.some(i=>i.useCount),false);
   const second=await page();await open(second);await account(second);const b=await (await second.context().request.get(base+'/api/access/session')).json();assert.equal(b.accountId,a.accountId);
   const guest=await page();await open(guest);await guest.locator('#invite-code').fill(batch.codes[0]);await guest.locator('#invite-form button').click();await guest.locator('.sidebar').waitFor();assert.equal(await guest.locator('[data-view="admin"]').count(),0);assert.equal((await guest.context().request.get(base+'/api/admin/overview')).status(),403);
   await p.locator('[data-view="admin"]').click();await p.locator('.stats').waitFor();assert.ok((await p.locator('.topbar').innerText()).includes('宋静雯'));await p.locator('[data-action="logout"]').click();await p.locator('#login-form').waitFor();
   await p.locator('[name="username"]').fill('宋静雯');await p.locator('[name="password"]').fill(password);await p.locator('#login-form button').click();await p.locator('.stats').waitFor();assert.equal((await (await p.context().request.get(base+'/api/access/session')).json()).accountId,a.accountId);
   assert.deepEqual(errors,[]);results.push({width,status:'PASS',checks:['homepage password login without invitation','same fixed identity in two independent browsers','ordinary invitation remains non-admin','dedicated administrator entry retained','wrong password rejected','password cleared on close','phone registration remains disabled']});
  }catch(e){results.push({width,status:'FAIL',error:e.stack});await p?.screenshot({path:path.join(out,'failure-'+width+'.png'),fullPage:true});}
  finally{for(const c of contexts)await c.close();await new Promise(r=>server.close(r));server=null;}
 }
})().catch(e=>results.push({fatal:e.stack})).finally(async()=>{await browser?.close();if(server)await new Promise(r=>server.close(r));fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results));if(results.some(r=>r.status==='FAIL'||r.fatal))process.exitCode=1;});
