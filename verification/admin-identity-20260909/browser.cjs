const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('/Users/song/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,process.argv[2]||'run-01');fs.mkdirSync(out);const results=[];let browser,server;
(async()=>{
 const {Admin}=await import(path.join(root,'dist/server/admin.js')),{InviteAccess,generateInvites}=await import(path.join(root,'dist/server/access.js')),{createApp}=await import(path.join(root,'dist/server/app.js'));
 browser=await chromium.launch({channel:'chrome',headless:true});
 for(const width of [1440,390]){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'shiye-identity-')),batch=generateInvites(2),file=path.join(dir,'invites.json'),receipt=path.join(dir,'account.txt');fs.writeFileSync(file,JSON.stringify(batch.config));
  const access=new InviteAccess(file),admin=new Admin(path.join(dir,'admin.json'),access);await admin.init({apiKey:'synthetic',secretKey:'synthetic',cutout:false,naming:false},receipt);
  const password=fs.readFileSync(receipt,'utf8').match(/密码：(.+)/)[1],data=JSON.parse(fs.readFileSync(admin.file,'utf8'));data.username='宋静雯';fs.writeFileSync(admin.file,JSON.stringify(data));
  const {app}=await createApp({runtime:path.join(dir,'runtime'),staticRoot:path.join(root,'shiye-editorial-prototype'),admin,access});server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
  const contexts=[],errors=[];
  async function context(){const c=await browser.newContext({viewport:{width,height:950},isMobile:width<500,hasTouch:width<500});contexts.push(c);await c.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());c.on('page',p=>{p.setDefaultTimeout(10000);p.on('pageerror',e=>errors.push(e.message));});return c;}
  async function invite(p,code){await p.goto(base,{waitUntil:'networkidle'});await p.locator('[data-action="access-open"]').click();await p.locator('#invite-code').fill(code);await p.locator('#invite-form [type="submit"]').click();await p.locator('.sidebar').waitFor();}
  async function login(p){await p.locator('[name="username"]').fill('宋静雯');await p.locator('[name="password"]').fill(password);await p.locator('#login-form button').click();await p.locator('.stats').waitFor();}
  let p;
  try{
   const normal=await context(),guest=await normal.newPage();await invite(guest,batch.codes[0]);assert.equal(await guest.locator('[data-view="admin"]').count(),0);assert.equal((await normal.request.get(base+'/api/admin/overview')).status(),403);
   await guest.screenshot({path:path.join(out,'guest-'+width+'.png'),fullPage:true});
   const owner=await context(),panel=await owner.newPage();p=panel;await panel.goto(base+'/admin',{waitUntil:'networkidle'});await login(panel);assert.ok((await panel.locator('.topbar').innerText()).includes('宋静雯'));
   const main=await owner.newPage();await main.goto(base,{waitUntil:'networkidle'});await main.locator('[data-action="home-create-sticker"]').click();await main.locator('[data-view="admin"]').waitFor();assert.ok((await main.locator('.profile-name').innerText()).includes('宋静雯'));await main.screenshot({path:path.join(out,'admin-'+width+'.png'),fullPage:true});
   await guest.reload({waitUntil:'networkidle'});await guest.locator('[data-action="home-create-sticker"]').click();await guest.locator('.sidebar').waitFor();assert.equal(await guest.locator('[data-view="admin"]').count(),0);
   const switcher=await owner.newPage();await invite(switcher,batch.codes[1]);assert.equal(await switcher.locator('[data-view="admin"]').count(),0);await main.locator('[data-view="admin"]').waitFor({state:'detached'});await panel.locator('#login-form').waitFor();assert.equal((await owner.request.get(base+'/api/admin/apis')).status(),403);
   await login(panel);await main.locator('[data-view="admin"]').waitFor();await panel.locator('[data-action="logout"]').click();await panel.locator('#login-form').waitFor();await main.locator('[data-view="admin"]').waitFor({state:'detached'});
   await login(panel);await main.locator('[data-view="admin"]').waitFor();const token=(await owner.cookies(base+'/api')).find(c=>c.name==='shiye_admin').value;await admin.logout(token);
   await main.evaluate(()=>window.dispatchEvent(new Event('focus')));await main.locator('[data-view="admin"]').waitFor({state:'detached'});await panel.evaluate(()=>window.dispatchEvent(new Event('focus')));await panel.locator('#login-form').waitFor();
   assert.deepEqual(errors,[]);results.push({width,status:'PASS',checks:['ordinary browser hidden and denied','administrator name and entry','independent browser isolation','invite switch clears all open administrator pages','login/logout tab synchronization','expired session removed on focus']});
  }catch(e){results.push({width,status:'FAIL',error:e.stack});await p?.screenshot({path:path.join(out,'failure-'+width+'.png'),fullPage:true});}
  finally{for(const c of contexts)await c.close();await new Promise(r=>server.close(r));server=null;}
 }
})().catch(e=>results.push({fatal:e.stack})).finally(async()=>{await browser?.close();if(server)await new Promise(r=>server.close(r));fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results));if(results.some(r=>r.status==='FAIL'||r.fatal))process.exitCode=1;});
